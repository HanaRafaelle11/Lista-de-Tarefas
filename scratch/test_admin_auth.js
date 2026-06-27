import { isAdmin, ADMIN_MASTER_EMAIL } from "../lib/auth/adminAuth.js";

function runTests() {
  console.log("=================================================");
  console.log("TESTANDO AUTORIZAÇÃO CENTRALIZADA DE ADMIN");
  console.log("Master Email:", ADMIN_MASTER_EMAIL);
  console.log("=================================================\n");

  const testCases = [
    { email: "hanarafaelle11@gmail.com", expected: true },
    { email: "HANARAFAELLE11@GMAIL.COM", expected: true },
    { email: " hanarafaelle11@gmail.com ", expected: true },
    { email: "hanarafaelle11s@gmail.com", expected: false },
    { email: "admin@flowday.app", expected: false },
    { email: "rafaelle@flowday.app", expected: false },
    { email: "user@example.com", expected: false },
    { email: null, expected: false },
    { email: undefined, expected: false }
  ];

  let allPassed = true;
  testCases.forEach((tc, idx) => {
    const res = isAdmin({ email: tc.email });
    const passed = res === tc.expected;
    console.log(`Test #${idx + 1} [${tc.email}]: Result = ${res} | Expected = ${tc.expected} -> ${passed ? "✅ PASS" : "❌ FAIL"}`);
    if (!passed) allPassed = false;
  });

  console.log("\n=================================================");
  console.log(allPassed ? "TODOS OS TESTES PASSARAM COM SUCESSO! 🟢" : "FALHA NOS TESTES DE AUTORIZAÇÃO! 🔴");
  console.log("=================================================");
}

runTests();
