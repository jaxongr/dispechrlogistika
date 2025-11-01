const fs = require("fs");
const dbData = JSON.parse(fs.readFileSync("../database/db.json", "utf8"));
const messages = dbData.messages || [];
const withoutPhone = messages.filter(m => !m.contact_phone || m.contact_phone === "null").slice(0, 15);

console.log(`\nTotal messages: ${messages.length}`);
console.log(`Without phone: ${messages.filter(m => !m.contact_phone || m.contact_phone === "null").length}\n`);
console.log("Sample messages without phone (first 15):");
console.log("=".repeat(100));

withoutPhone.forEach((msg, i) => {
  console.log(`\n[${i+1}] From: ${msg.from_username || msg.from_name}`);
  console.log(`Group: ${msg.group_name}`);
  const text = (msg.message_text || "").substring(0, 400);
  console.log(`Text: ${text}`);
  console.log("-".repeat(100));
});
