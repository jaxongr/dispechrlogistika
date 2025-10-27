const { db } = require('../config/database');

console.log('📊 XABARLARDAGI GURUHLAR STATISTIKASI\n');

const messages = db.get('messages').value() || [];

console.log('📨 Jami xabarlar:', messages.length);

// Guruh bo'yicha guruhlash
const groupMap = new Map();

messages.forEach(msg => {
  const groupId = msg.group_id;
  const groupName = msg.group_name || 'Noma\'lum';

  if (!groupMap.has(groupId)) {
    groupMap.set(groupId, {
      id: groupId,
      name: groupName,
      count: 0
    });
  }

  groupMap.get(groupId).count++;
});

console.log('\n🔢 Noyob guruhlar soni:', groupMap.size);
console.log('\n' + '='.repeat(80) + '\n');

// Sortlash - eng ko'p xabar yuborilgandan boshlab
const sortedGroups = Array.from(groupMap.values())
  .sort((a, b) => b.count - a.count);

console.log('📊 GURUHLAR (XABARLAR SONI BO\'YICHA):\n');

sortedGroups.forEach((g, i) => {
  console.log(`${i+1}. ${g.name}`);
  console.log(`   ID: ${g.id}`);
  console.log(`   Xabarlar: ${g.count} ta\n`);
});
