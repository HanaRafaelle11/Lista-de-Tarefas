export default function handler(req, res) {
  console.log("🔥 PING WORKER EXECUTADO:", new Date().toISOString());

  return res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    service: "worker-ping"
  });
}
