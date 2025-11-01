const dispatcherDetector = require('./backend/src/services/dispatcher-detector');

// Test cases
const testMessages = [
  "Qashqadaryo Kitobdan\nNavoiyga yuk bor schakman kk 20 tonna\nTel 200070058",
  "Qóqon Toshkent\nTentofka yoki Plashatka fura kerak 5 ta\nKafel yuklanadi 24.5 tonnadan\nErtaga ertalab yuklanadi\n200046675",
  "Toshkent\nQashqadaryo\n20 tonna\n200011444",
  "88.149.04.07 Toshkent Samarqandga yuk bor",
  "90 123 45 67 format",
  "+998 90 123 45 67 format",
  "998901234567 format"
];

console.log("=".repeat(100));
console.log("TELEFON RAQAM EXTRACTION TEST");
console.log("=".repeat(100));

testMessages.forEach((msg, i) => {
  const result = dispatcherDetector.extractLogisticsData(msg);
  console.log(`\n[Test ${i+1}]`);
  console.log(`Message: ${msg.substring(0, 80)}`);
  console.log(`Phone: ${result.contact_phone || '❌ TOPILMADI'}`);
  console.log("-".repeat(100));
});
