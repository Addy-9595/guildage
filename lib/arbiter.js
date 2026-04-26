const ARBITER_URL = process.env.ARBITER_API_URL || "https://arbiter-gvm7m9x4o-nishantneus-projects.vercel.app";

async function verifyWithArbiter(agentId, agentName, serviceType, taskInput, taskOutput) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${ARBITER_URL}/api/integration/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        agent_id: agentId,
        agent_name: agentName,
        service_type: serviceType,
        task_input: taskInput,
        task_output: taskOutput,
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error("Arbiter error:", res.status);
      return null;
    }
    const result = await res.json();
    console.log(`Arbiter verified agent ${agentName}: score=${result.score} passed=${result.passed} tier=${result.trust_tier}`);
    return result;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      console.error("Arbiter timeout: request exceeded 15s");
    } else {
      console.error("Arbiter connection error:", err.message);
    }
    return null;
  }
}

module.exports = { verifyWithArbiter };
