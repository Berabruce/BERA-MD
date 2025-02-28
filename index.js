const {
  default: BeraConnect,
  useMultiFileAuthState,
  DisconnectReason,
  Boom,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  downloadContentFromMessage,
  jidDecode,
  proto,
  Browsers,
  getContentType,
} = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const axios = require("axios");
const chalk = require("chalk");
const { File } = require("megajs");
const express = require("express");
const app = express();
const port = process.env.PORT || 10000;
const { smsg } = require("./smsg");
const { autoview, autoread, botname, autobio, mode, prefix, session, autoreact, presence, autolike, anticall } = require("./settings");
const { DateTime } = require("luxon");
const { commands, totalCommands } = require("./commandHandler");
const groupEvents = require("./groupEvents.js");

const store = makeInMemoryStore({ logger: P().child({ level: "silent", stream: "store" }) });

// Session Authentication
async function authenticateSession() {
  if (!fs.existsSync(path.join(__dirname, 'session', 'creds.json'))) {
    if (!session) {
      return console.log('Please provide a session file to continue.');
    }

    const sessdata = session;
    const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);

    try {
      await new Promise((resolve, reject) => {
        filer.download((err, data) => {
          if (err) return reject(err);
          fs.writeFile(path.join(__dirname, 'session', 'creds.json'), data, () => {
            console.log("SESSION DOWNLOADED COMPLETED ✅");
            resolve();
          });
        });
      });
    } catch (err) {
      console.log("Error downloading session:", err);
    }
  }
}

async function startBera() {
  const { saveCreds, state } = await useMultiFileAuthState(path.join(__dirname, 'session'));
  const { version } = await fetchLatestBaileysVersion();

  const client = BeraConnect({
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS("Firefox"),
    shouldSyncHistoryMessage: true,
    downloadHistory: true,
    syncFullHistory: true,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: true,
    keepAliveIntervalMs: 30000,
    auth: state,
    version,
    getMessage: async (key) => {
      if (store) {
        const mssg = await store.loadMessage(key.remoteJid, key.id);
        return mssg.message || undefined;
      }
      return { conversation: "HERE" };
    }
  });

  let lastTextTime = 0;
  const messageDelay = 5000;

  if (autobio === "true") {
    setInterval(() => {
      const date = new Date();
      client.updateProfileStatus(
        `${botname} is active 24/7\n\n${date.toLocaleString("en-US", { timeZone: "Africa/Nairobi" })} It's a ${date.toLocaleString("en-US", { weekday: "long", timeZone: "Africa/Nairobi" })}.`
      );
    }, 10 * 1000);
  }

  let lastTextTime = 0;
  const messageDelay = 5000;

  // Handle incoming calls if anticall is enabled
  client.ev.on('call', async (callData) => {
    if (anticall === 'true') {
      const callId = callData[0].id;
      const callerId = callData[0].from;

      // Reject the call
      await client.rejectCall(callId, callerId);

      const currentTime = Date.now();
      if (currentTime - lastTextTime >= messageDelay) {
        await client.sendMessage(callerId, {
          text: anticallmsg
        });
        lastTextTime = currentTime;
      } else {
        console.log('Message skipped to prevent overflow');
      }
    }
  });

  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = mek.message.ephemeralMessage?.message || mek.message;

      if (autoview === "true" && mek.key?.remoteJid === "status@broadcast") {
        await client.readMessages([mek.key]);
      } else if (autoread === "true" && mek.key?.remoteJid.endsWith("@s.whatsapp.net")) {
        await client.readMessages([mek.key]);
      }
      if (autoview === 'true' && autolike === 'true' && mek.key && mek.key.remoteJid === "status@broadcast") {
        const Beralike = await client.decodeJid(client.user.id);
        const emojis = ['😂', '😥', '😇', '🥹', '💥', '💯', '🔥', '💫', '👽', '💗', '❤️‍🔥', '👁️', '👀', '🙌', '🙆', '🌟', '💧', '🎇', '🎆', '♂️', '✅'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        const delayMessage = 3000;
        await client.sendMessage(mek.key.remoteJid, {
          react: {
            text: randomEmoji,
            key: mek.key,
          }
        }, { statusJidList: [mek.key.participant, Beralike] });
        await sleep(delayMessage);
      }

      if (mek.key?.remoteJid.endsWith("@s.whatsapp.net")) {
        const presenceType = presence === "online" ? "available" : presence === "typing" ? "composing" : presence === "recording" ? "recording" : "unavailable";
        await client.sendPresenceUpdate(presenceType, mek.key.remoteJid);
      }

      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;

      const m = smsg(client, mek, store);

      // Command Handler Logic
      const body = m.mtype === "conversation" ? m.message.conversation :
        m.mtype === "imageMessage" ? m.message.imageMessage.caption :
          m.mtype === "extendedTextMessage" ? m.message.extendedTextMessage.text : "";

      const cmd = body.startsWith(prefix);
      const args = body.trim().split(/ +/).slice(1);
      const pushname = m.pushName || "No Name";
      const botNumber = await client.decodeJid(client.user.id);
      const isBotMessage = m.sender === botNumber;  
      const itsMe = m.sender === botNumber;
      const text = args.join(" ");
      const isOwner = dev.split(",").map(v => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net").includes(m.sender);
      const Tag = m.mtype === "extendedTextMessage" && m.message.extendedTextMessage.contextInfo != null
        ? m.message.extendedTextMessage.contextInfo.mentionedJid
        : [];

      let msgBera = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
      let budy = typeof m.text === "string" ? m.text : "";

      const timestamp = speed();
      const Beraspeed = speed() - timestamp;

      const getGroupAdmins = (participants) => {
        let admins = [];
        for (let i of participants) {
          if (i.admin === "superadmin") admins.push(i.id);
          if (i.admin === "admin") admins.push(i.id);
        }
        return admins || [];
      };

      const bruce = m.quoted || m;
      const quoted = bruce.mtype === 'buttonsMessage' ? bruce[Object.keys(bruce)[1]] :
        bruce.mtype === 'templateMessage' ? bruce.hydratedTemplate[Object.keys(bruce.hydratedTemplate)[1]] :
          bruce.mtype === 'product' ? bruce[Object.keys(bruce)[0]] : m.quoted ? m.quoted : m;

      const color = (text, color) => {
        return color ? chalk.keyword(color)(text) : chalk.green(text);
      };

      const mime = quoted.mimetype || "";
      const qmsg = quoted;

      const DevBera = dev.split(",");
      const Owner = DevBera.map(v => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net").includes(m.sender);

      const groupMetadata = m.isGroup ? await client.groupMetadata(m.chat).catch(() => {}) : "";
      const groupName = m.isGroup && groupMetadata ? groupMetadata.subject : "";
      const participants = m.isGroup && groupMetadata ? groupMetadata.participants : [];
      const groupAdmin = m.isGroup ? getGroupAdmins(participants) : [];
      const isBotAdmin = m.isGroup ? groupAdmin.includes(botNumber) : false;
      const isAdmin = m.isGroup ? groupAdmin.includes(m.sender) : false;

      const IsGroup = m.chat?.endsWith("@g.us");
       
      const context = {
        client, m, text, isBotMessage, Owner, chatUpdate, store, isBotAdmin, isOwner, isAdmin, IsGroup,
        participants, pushname, body, budy, totalCommands, args, mime, qmsg, msgKeith, botNumber, itsMe, packname,
        author, generateProfilePicture, groupMetadata, Beraspeed, mycode, fetchJson, exec, antibad, getRandom, UploadFileUgu,
        TelegraPh, prefix, cmd, botname, mode, antitag, antilink, antidelete, antionce, fetchBuffer,
        store, uploadtoimgur, chatUpdate, ytmp3, getGroupAdmins, Tag
      };


      // Antilink Logic
      const forbiddenLinkPattern = /https?:\/\/[^\s]+/;
      if (body && forbiddenLinkPattern.test(body) && m.isGroup && antilink === 'true' && !isOwner && isBotAdmin && !isAdmin) {
        if (itsMe) return;

        const kid = m.sender;

        await client.sendMessage(m.chat, {
          text: `🚫link detected🚫\n\n@${kid.split("@")[0]}, do not send links!`,
          contextInfo: { mentionedJid: [kid] }
        }, { quoted: m });

        await client.sendMessage(m.chat, {
          delete: {
            remoteJid: m.chat,
            fromMe: false,
            id: m.key.id,
            participant: kid
          }
        });

        if (!isBotAdmin) {
          await client.sendMessage(m.chat, {
            text: `Please promote me to an admin to remove @${kid.split("@")[0]} for sharing link.`,
          });
        } else {
          await client.groupParticipantsUpdate(m.chat, [kid], 'remove');
        }
      }

      // Antibad Word Logic
      const forbiddenWords = [
        'kuma',
        'mafi',
        'kumbavu',
        'ngombe',
        'fala',
        'asshole',
        'cunt',
        'cock',
        'slut',
        'fag'
        'umbwa'
        'mrija'
      ];

      if (body && forbiddenWords.some(word => body.toLowerCase().includes(word))) {
        if (m.isGroup && antibad === 'true') {
          if (isBotAdmin && !isOwner && !isAdmin) {
            const kid = m.sender;

            await client.sendMessage(m.chat, {
              text: `🚫bad word detected 🚫\n\n@${kid.split("@")[0]}, do not send offensive words!`,
              contextInfo: { mentionedJid: [kid] }
            }, { quoted: m });

            await client.sendMessage(m.chat, {
              delete: {
                remoteJid: m.chat,
                fromMe: false,
                id: m.key.id,
                participant: kid
              }
            });

            await client.groupParticipantsUpdate(m.chat, [kid], 'remove');
            await client.updateBlockStatus(kid, 'block');
          }
        } else if (!m.isGroup && antibad === 'true') {
          const kid = m.sender;
          await client.updateBlockStatus(kid, 'block');
        }
      }

      if (cmd && mode === "private" && !itsMe && !isOwner && m.sender !== daddy) return;

      const command = cmd ? body.replace(prefix, "").trim().split(/ +/).shift().toLowerCase() : null;
      if (command) {
        const commandObj = commands[command];
        if (commandObj) {
          await commandObj.execute({ client, m, text, totalCommands, prefix, groupAdmin, getGroupAdmins, args, groupName, groupMetadata, participants, isOwner, pushname, botNumber, itsMe, store, isAdmin, isBotAdmin });
        }
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
  });

  process.on("Something went wrong", (err) => {
    console.error("Caught exception:", err);
  });

  client.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      const decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    }
    return jid;
  };

  client.getName = async (jid) => {
    const id = client.decodeJid(jid);
    if (id.endsWith("@g.us")) {
      const group = store.contacts[id] || (await client.groupMetadata(id)) || {};
      return group.name || group.subject || PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international");
    }
    const contact = store.contacts[id] || {};
    return contact.name || contact.subject || contact.verifiedName || PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international");
  };

  client.public = true;
  client.serializeM = (m) => smsg(client, m, store);

  client.ev.on("group-participants.update", (m) => groupEvents(client, m));

  client.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      const reasons = {
        [DisconnectReason.badSession]: "Bad Session File, Please Delete Session and Scan Again",
        [DisconnectReason.connectionClosed]: "Connection closed, reconnecting...",
        [DisconnectReason.connectionLost]: "Connection Lost from Server, reconnecting...",
        [DisconnectReason.connectionReplaced]: "Connection Replaced, Another New Session Opened, Please Restart Bot",
        [DisconnectReason.loggedOut]: "Device Logged Out, Please Delete File creds.json and Scan Again",
        [DisconnectReason.restartRequired]: "Restart Required, Restarting...",
        [DisconnectReason.timedOut]: "Connection TimedOut, Reconnecting...",
      };
      console.log(reasons[reason] || `Unknown DisconnectReason: ${reason}`);
      if (reason === DisconnectReason.badSession || reason === DisconnectReason.connectionReplaced || reason === DisconnectReason.loggedOut) {
        process.exit();
      } else {
        startBera();
      }
    } else if (connection === "open") {
      await client.groupAcceptInvite("DvXonepPp1XBPOYIBziTl1");
      console.log(`✅ Connection successful\nLoaded ${totalCommands} commands.\nBot is active.`);

      const getGreeting = () => {
        const currentHour = DateTime.now().setZone("Africa/Nairobi").hour;
        if (currentHour >= 5 && currentHour < 12) return "Good morning 🌄";
        if (currentHour >= 12 && currentHour < 18) return "Good afternoon ☀️";
        if (currentHour >= 18 && currentHour < 22) return "Good evening 🌆";
        return "Good night 😴";
      };

      const message = `Holla, ${getGreeting()},\n\n╭═══『BERA MD IS CONNECTED SUCCESSFULLY 』══⊷ \n` +
        `║ ʙᴏᴛ ɴᴀᴍᴇ ${botname}\n` +
        `║ �ᴍᴏᴅᴇ ${mode}\n` +
        `║ ᴘʀᴇғɪx [  ${prefix} ]\n` +
        `║ ᴛᴏᴛᴀʟ ᴘʟᴜɢɪɴs ${totalCommands}\n` +
        `║ ᴛɪᴍᴇ ${DateTime.now().setZone("Africa/Nairobi").toLocaleString(DateTime.TIME_SIMPLE)}\n` +
        `║ ʟɪʙʀᴀʀʏ Baileys\n` +
        `╰═════════════════⊷`;

      await client.sendMessage(client.user.id, { text: message });
    }
  });

  client.ev.on("creds.update", saveCreds);

  client.sendText = (jid, text, quoted = "", options) => client.sendMessage(jid, { text, ...options }, { quoted });

  client.downloadMediaMessage = async (message) => {
    const mime = (message.msg || message).mimetype || "";
    const messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];
    const stream = await downloadContentFromMessage(message, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
  };

  client.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
    const quoted = message.msg || message;
    const mime = (message.msg || message).mimetype || "";
    const messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];
    const stream = await downloadContentFromMessage(quoted, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    const type = await FileType.fromBuffer(buffer);
    const trueFileName = attachExtension ? `${filename}.${type.ext}` : filename;
    await fs.writeFileSync(trueFileName, buffer);
    return trueFileName;
  };
}

app.use(express.static("public"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));

startBera();

module.exports = startBera;

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});
