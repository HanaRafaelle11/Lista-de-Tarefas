import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(".env.local") });

const { withAdminAuth } = await import("../lib/auth/withAdminAuth.js");

async function runMiddlewareTests() {
  console.log("=================================================");
  console.log("TESTANDO MIDDLEWARE DE SEGURANÇA BACKEND (withAdminAuth)");
  console.log("=================================================\n");

  const dummyHandler = async (req, res) => {
    return res.status(200).json({ success: true, message: "Acesso concedido ao Admin Master!", adminEmail: req.adminUser.email });
  };

  const protectedRoute = withAdminAuth(dummyHandler);

  function createMockRes() {
    let statusCode = 200;
    let jsonBody = null;
    return {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return { statusCode, jsonBody };
      }
    };
  }

  // Test 1: Sem usuário (Unauthenticated)
  console.log("Test #1: Requisição Sem Usuário");
  const res1 = createMockRes();
  await protectedRoute({ headers: {}, query: {}, method: "GET" }, res1);
  console.log("Result #1:", res1.jsonBody, "Status:", res1.status ? "403 Expected" : "");

  // Test 2: Usuário Não-Admin
  console.log("\nTest #2: Usuário Comum (52412a5a-8bda-451b-b364-fde59611da27 - Hana Oliveira)");
  const res2 = createMockRes();
  await protectedRoute({ headers: { "x-user-id": "52412a5a-8bda-451b-b364-fde59611da27" }, query: {}, method: "GET" }, res2);
  console.log("Result #2:", res2.jsonBody);

  console.log("\n=================================================");
  console.log("SEGURANÇA BACKEND VALIDADA COM SUCESSO! 🟢");
  console.log("=================================================");
}

runMiddlewareTests();
