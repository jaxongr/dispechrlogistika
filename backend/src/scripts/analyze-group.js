const { db } = require('../config/database');

console.log('📊 GURUH TAHLILI - Oxirgi 3 soat\n');
console.log('='.repeat(80));

const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);

// Get all messages from database
const allMessages = db.get('messages').value() || [];

// Oxirgi 3 soatdagi xabarlar
const recentMessages = allMessages.filter(m => {
  const msgTime = new Date(m.created_at).getTime();
  return msgTime > threeHoursAgo;
});

console.log(`\n📨 UMUMIY (oxirgi 3 soat):`);
console.log(`   Jami xabarlar database'da: ${recentMessages.length} ta\n`);

// Group messages by group_name
const groupMap = new Map();

recentMessages.forEach(msg => {
  const groupName = msg.group_name || 'Noma\'lum';
  if (!groupMap.has(groupName)) {
    groupMap.set(groupName, []);
  }
  groupMap.get(groupName).push(msg);
});

// Find YUK markazi group
let targetGroup = null;
for (const [name, messages] of groupMap.entries()) {
  if (name.includes('YUK') && name.includes('markazi') && name.includes('🌏')) {
    targetGroup = { name, messages };
    break;
  }
}

if (!targetGroup) {
  console.log('❌ 🌏YUK_🎯markazi🇺🇿 guruhidan oxirgi 3 soatda xabar topilmadi!\n');
  console.log('📋 Mavjud guruhlar (oxirgi 3 soat):');

  const sortedGroups = Array.from(groupMap.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  sortedGroups.forEach(([name, msgs], i) => {
    console.log(`   ${i+1}. ${name} - ${msgs.length} ta xabar`);
  });

  process.exit(0);
}

console.log(`✅ TOPILDI: ${targetGroup.name}`);
console.log(`📊 Guruhga o'tgan xabarlar: ${targetGroup.messages.length} ta\n`);

// Now check logs for filtered messages from this group
console.log('🔍 Loglardan filter qilingan xabarlarni qidiryapman...\n');
console.log('⚠️  Qisqa vaqt ichida log tekshirish - to\'liq ma\'lumot uchun PM2 logs kerak\n');
