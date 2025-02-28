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
          text: '```*Bera Md Rejected the Call Because Owner Is Busy. Please Text instead*```.',
        });
        lastTextTime = currentTime;
      } else {
        console.log('Message skipped to prevent overflow');
      }
    }
  });

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
  // Auto react if enabled
  if (autoreact === 'true') {
    client.ev.on("messages.upsert", async (chatUpdate) => {
      try {
        const mek = chatUpdate.messages[0];
        if (!mek || !mek.message) return;

        const reactEmojis = ['✅', '♂️', '🎆', '🎇', '💧', '🌟', '🙆', '🙌', '👀', '👁️', '❤️‍🔥', '💗', '👽', '💫', '🔥', '💯', '💥', '😇', '😥', '😂', '👋'];

        if (!mek.key.fromMe && reactEmojis.length > 0) {
          const randomEmoji = reactEmojis[Math.floor(Math.random() * reactEmojis.length)];
          await client.sendMessage(mek.key.remoteJid, {
            react: {
              text: randomEmoji,
              key: mek.key,
            },
          });
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });
  }

  // Auto bio update
  if (autobio === 'true') {
    setInterval(() => {
      const date = new Date();
      client.updateProfileStatus(
        `${botname} is active 24/7\n\n${date.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })} It's a ${date.toLocaleString('en-US', { weekday: 'long', timeZone: 'Africa/Nairobi' })}.`
      );
    }, 10 * 1000);
  }

  // Handle incoming messages and auto read/auto view features
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = Object.keys(mek.message)[0] === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;

 if (autoview === 'true' && autolike === 'true' && mek.key && mek.key.remoteJid === "status@broadcast") {

const bruce = await client.decodeJid(client.user.id);

if (mek.status) return;

await client.sendMessage(mek.key.remoteJid, { react: { key: mek.key, text: '❤️‍🔥'}}, { statusJidList: [mek.key.participant, bruce] });
}


            if (autoview === 'true' && mek.key && mek.key.remoteJid === "status@broadcast") { 
         await client.readMessages([mek.key]);}
else if (autoread === 'true' && mek.key && mek.key.remoteJid.endsWith('@s.whatsapp.net')) { 

await client.readMessages([mek.key]);

}

if (mek.key && mek.key.remoteJid.endsWith('@s.whatsapp.net')) { 


const Chat = mek.key.remoteJid;
if(presence === 'online')

            {await client.sendPresenceUpdate("available",Chat);}
            else if(presence === 'typing')
            {await client.sendPresenceUpdate("composing",Chat);}
            else if(presence === 'recording')
            {
            await client.sendPresenceUpdate("recording", Chat);
            }
            else
            {
                await client.sendPresenceUpdate("unavailable", Chat);
            }
}


      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
      
      m = smsg(client, mek, store);
      require("./Bera")(client, m, chatUpdate, store);
    } catch (err) {
      console.log(err);
    }
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.log("Unhandled Rejection at:", promise, "reason:", reason);
  });

  process.on("rejectionHandled", (promise) => {
    unhandledRejections.delete(promise);
  });

  process.on("uncaughtException", function (err) {
    console.log("Caught exception: ", err);
  });

  client.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    } else return jid;
  };

  client.getName = (jid, withoutContact = false) => {
    id = client.decodeJid(jid);
    withoutContact = client.withoutContact || withoutContact;
    let v;
    if (id.endsWith("@g.us"))
      return new Promise(async (resolve) => {
        v = store.contacts[id] || {};
        if (!(v.name || v.subject)) v = client.groupMetadata(id) || {};
        resolve(v.name || v.subject || PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international"));
      });
    else
      v =
        id === "0@s.whatsapp.net"
          ? {
              id,
              name: "WhatsApp",
            }
          : id === client.decodeJid(client.user.id)
          ? client.user
          : store.contacts[id] || {};
    return (withoutContact ? "" : v.name) || v.subject || v.verifiedName || PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber("international");
  };

  client.public = true;
  client.serializeM = (m) => smsg(client, m, store);

  client.ev.on("group-participants.update", async (m) => {
    groupEvents(client, m);
  });

  client.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      if (reason === DisconnectReason.badSession) {
        console.log(`Bad Session File, Please Delete Session and Scan Again`);
        process.exit();
      } else if (reason === DisconnectReason.connectionClosed) {
        console.log("Connection closed, reconnecting....");
        startBera();
      } else if (reason === DisconnectReason.connectionLost) {
        console.log("Connection Lost from Server, reconnecting...");
        startBera();
      } else if (reason === DisconnectReason.connectionReplaced) {
        console.log("Connection Replaced, Another New Session Opened, Please Restart Bot");
        process.exit();
      } else if (reason === DisconnectReason.loggedOut) {
        console.log(`Device Logged Out, Please Delete File creds.json and Scan Again.`);
        process.exit();
      } else if (reason === DisconnectReason.restartRequired) {
        console.log("Restart Required, Restarting...");
        startBera();
      } else if (reason === DisconnectReason.timedOut) {
        console.log("Connection TimedOut, Reconnecting...");
        startBera();
      } else {
        console.log(`Unknown DisconnectReason: ${reason}|${connection}`);
        startBera();
      }
    } else if (connection === "open") {
      console.log(`✅ Connection successful\nLoaded ${totalCommands} commands.\nBot is active.`);
client.groupAcceptInvite("DvXonepPp1XBPOYIBziTl1");
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
  client.sendText = (jid, text, quoted = "", options) => client.sendMessage(jid, { text: text, ...options }, { quoted });
}

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));

// Authentication and Session Fix
authenticateSession().then(() => startBera());
