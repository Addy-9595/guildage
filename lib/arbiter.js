const ARBITER_URL = (process.env.ARBITER_API_URL || "https://arbiter-gvm7m9x4o-nishantneus-projects.vercel.app").replace(/\/$/, "");

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

function syncAgentToArbiter(agent) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  fetch(`${ARBITER_URL}/api/integration/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      event: "agent_registered",
      data: {
        agent_id: agent.id,
        name: agent.name,
        owner_name: agent.owner_name,
        skills: agent.skills,
        token_balance: agent.token_balance,
        deposit_sats: agent.deposit_sats,
      },
    }),
  })
    .then((res) => { clearTimeout(timeout); console.log(`Arbiter sync agent_registered: ${res.status}`); })
    .catch((err) => { clearTimeout(timeout); console.error("Arbiter syncAgent error:", err.message); });
}

function syncTaskToArbiter(agentId, taskId, description, tokensEarned, verification) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  fetch(`${ARBITER_URL}/api/integration/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      event: "task_completed",
      data: {
        agent_id: agentId,
        task_id: taskId,
        description: description,
        tokens_earned: tokensEarned,
        verification: verification,
      },
    }),
  })
    .then((res) => { clearTimeout(timeout); console.log(`Arbiter sync task_completed: ${res.status}`); })
    .catch((err) => { clearTimeout(timeout); console.error("Arbiter syncTask error:", err.message); });
}

function syncSwapToArbiter(swapId, requesterId, providerId, skill) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  fetch(`${ARBITER_URL}/api/integration/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      event: "swap_completed",
      data: {
        swap_id: swapId,
        requester_agent_id: requesterId,
        provider_agent_id: providerId,
        skill_requested: skill,
      },
    }),
  })
    .then((res) => { clearTimeout(timeout); console.log(`Arbiter sync swap_completed: ${res.status}`); })
    .catch((err) => { clearTimeout(timeout); console.error("Arbiter syncSwap error:", err.message); });
}

function syncBorrowToArbiter(borrowId, borrowerId, providerId, skill, tokensPaid) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  fetch(`${ARBITER_URL}/api/integration/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      event: "borrow_completed",
      data: {
        borrow_id: borrowId,
        borrower_agent_id: borrowerId,
        provider_agent_id: providerId,
        skill_requested: skill,
        tokens_paid: tokensPaid,
      },
    }),
  })
    .then((res) => { clearTimeout(timeout); console.log(`Arbiter sync borrow_completed: ${res.status}`); })
    .catch((err) => { clearTimeout(timeout); console.error("Arbiter syncBorrow error:", err.message); });
}

module.exports = { verifyWithArbiter, syncAgentToArbiter, syncTaskToArbiter, syncSwapToArbiter, syncBorrowToArbiter };
