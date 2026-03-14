const { detectBroker, parseRobinhood } = require('../lib/broker-parsers');

const mockCsv = `Order ID,Process Date,Instrument,Activity Type,Quantity,Price,Settlement Date,Status
ORD123,2026-03-10,AAPL,Buy,10,150.00,2026-03-12,Filled
ORD456,2026-03-11,TSLA,Sell,5,200.00,2026-03-13,Filled
`;

try {
  console.log("Detecting broker...");
  const broker = detectBroker(mockCsv);
  console.log("Detected:", broker);

  if (broker === "robinhood") {
    const trades = parseRobinhood(mockCsv);
    console.log("Parsed Trades Count:", trades.length);
    if (trades.length === 2 && trades[0].symbol === "AAPL") {
      console.log("✅ Robinhood Parser PASS");
    } else {
      console.log("❌ Robinhood Parser FAIL - Data mismatch");
      process.exit(1);
    }
  } else {
    console.log("❌ Broker detection FAIL");
    process.exit(1);
  }
} catch (e) {
  console.error("EXECUTION ERROR:", e.message);
  process.exit(1);
}
