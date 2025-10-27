const { db } = require('../config/database');

console.log('📊 GURUHLAR STATISTIKASI\n');

const groups = db.get('groups').value() || [];
const messages = db.get('messages').value() || [];

console.log('🔢 Jami kuzatilayotgan guruhlar:', groups.length);
console.log('📨 Jami xabarlar:', messages.length);
console.log('\n' + '='.repeat(80) + '\n');

// Har bir guruh uchun xabarlar soni
const groupStats = groups.map(group => {
  const groupMessages = messages.filter(m => m.group_id === group.group_id);
  return {
    name: group.group_name,
    id: group.group_id,
    messageCount: groupMessages.length
  };
}).sort((a, b) => a.messageCount - b.messageCount);

// Hech xabar kelmagan guruhlar
console.log('❌ HECH XABAR KELMAGAN GURUHLAR:\n');
const emptyGroups = groupStats.filter(g => g.messageCount === 0);
console.log('Soni:', emptyGroups.length);
emptyGroups.slice(0, 20).forEach((g, i) => {
  console.log(`${i+1}. ${g.name} (ID: ${g.id})`);
});

console.log('\n' + '='.repeat(80) + '\n');

// Kam xabar kelgan guruhlar (1-10 ta)
console.log('⚠️  KAM XABAR KELGAN GURUHLAR (1-10 ta):\n');
const fewMessages = groupStats.filter(g => g.messageCount > 0 && g.messageCount <= 10);
console.log('Soni:', fewMessages.length);
fewMessages.forEach((g, i) => {
  console.log(`${i+1}. ${g.name} - ${g.messageCount} ta xabar`);
});

console.log('\n' + '='.repeat(80) + '\n');

// Eng ko'p xabar kelgan guruhlar
console.log('✅ ENG KO\'P XABAR KELGAN GURUHLAR (TOP 10):\n');
groupStats.slice(-10).reverse().forEach((g, i) => {
  console.log(`${i+1}. ${g.name} - ${g.messageCount} ta xabar`);
});
