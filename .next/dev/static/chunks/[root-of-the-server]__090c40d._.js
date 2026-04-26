(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[turbopack]/browser/dev/hmr-client/hmr-client.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/// <reference path="../../../shared/runtime/runtime-types.d.ts" />
/// <reference path="../../../shared/runtime/dev-globals.d.ts" />
/// <reference path="../../../shared/runtime/dev-protocol.d.ts" />
/// <reference path="../../../shared/runtime/dev-extensions.ts" />
__turbopack_context__.s([
    "connect",
    ()=>connect,
    "setHooks",
    ()=>setHooks,
    "subscribeToUpdate",
    ()=>subscribeToUpdate
]);
function connect({ addMessageListener, sendMessage, onUpdateError = console.error }) {
    addMessageListener((msg)=>{
        switch(msg.type){
            case 'turbopack-connected':
                handleSocketConnected(sendMessage);
                break;
            default:
                try {
                    if (Array.isArray(msg.data)) {
                        for(let i = 0; i < msg.data.length; i++){
                            handleSocketMessage(msg.data[i]);
                        }
                    } else {
                        handleSocketMessage(msg.data);
                    }
                    applyAggregatedUpdates();
                } catch (e) {
                    console.warn('[Fast Refresh] performing full reload\n\n' + "Fast Refresh will perform a full reload when you edit a file that's imported by modules outside of the React rendering tree.\n" + 'You might have a file which exports a React component but also exports a value that is imported by a non-React component file.\n' + 'Consider migrating the non-React component export to a separate file and importing it into both files.\n\n' + 'It is also possible the parent component of the component you edited is a class component, which disables Fast Refresh.\n' + 'Fast Refresh requires at least one parent function component in your React tree.');
                    onUpdateError(e);
                    location.reload();
                }
                break;
        }
    });
    const queued = globalThis.TURBOPACK_CHUNK_UPDATE_LISTENERS;
    if (queued != null && !Array.isArray(queued)) {
        throw new Error('A separate HMR handler was already registered');
    }
    globalThis.TURBOPACK_CHUNK_UPDATE_LISTENERS = {
        push: ([chunkPath, callback])=>{
            subscribeToChunkUpdate(chunkPath, sendMessage, callback);
        }
    };
    if (Array.isArray(queued)) {
        for (const [chunkPath, callback] of queued){
            subscribeToChunkUpdate(chunkPath, sendMessage, callback);
        }
    }
}
const updateCallbackSets = new Map();
function sendJSON(sendMessage, message) {
    sendMessage(JSON.stringify(message));
}
function resourceKey(resource) {
    return JSON.stringify({
        path: resource.path,
        headers: resource.headers || null
    });
}
function subscribeToUpdates(sendMessage, resource) {
    sendJSON(sendMessage, {
        type: 'turbopack-subscribe',
        ...resource
    });
    return ()=>{
        sendJSON(sendMessage, {
            type: 'turbopack-unsubscribe',
            ...resource
        });
    };
}
function handleSocketConnected(sendMessage) {
    for (const key of updateCallbackSets.keys()){
        subscribeToUpdates(sendMessage, JSON.parse(key));
    }
}
// we aggregate all pending updates until the issues are resolved
const chunkListsWithPendingUpdates = new Map();
function aggregateUpdates(msg) {
    const key = resourceKey(msg.resource);
    let aggregated = chunkListsWithPendingUpdates.get(key);
    if (aggregated) {
        aggregated.instruction = mergeChunkListUpdates(aggregated.instruction, msg.instruction);
    } else {
        chunkListsWithPendingUpdates.set(key, msg);
    }
}
function applyAggregatedUpdates() {
    if (chunkListsWithPendingUpdates.size === 0) return;
    hooks.beforeRefresh();
    for (const msg of chunkListsWithPendingUpdates.values()){
        triggerUpdate(msg);
    }
    chunkListsWithPendingUpdates.clear();
    finalizeUpdate();
}
function mergeChunkListUpdates(updateA, updateB) {
    let chunks;
    if (updateA.chunks != null) {
        if (updateB.chunks == null) {
            chunks = updateA.chunks;
        } else {
            chunks = mergeChunkListChunks(updateA.chunks, updateB.chunks);
        }
    } else if (updateB.chunks != null) {
        chunks = updateB.chunks;
    }
    let merged;
    if (updateA.merged != null) {
        if (updateB.merged == null) {
            merged = updateA.merged;
        } else {
            // Since `merged` is an array of updates, we need to merge them all into
            // one, consistent update.
            // Since there can only be `EcmascriptMergeUpdates` in the array, there is
            // no need to key on the `type` field.
            let update = updateA.merged[0];
            for(let i = 1; i < updateA.merged.length; i++){
                update = mergeChunkListEcmascriptMergedUpdates(update, updateA.merged[i]);
            }
            for(let i = 0; i < updateB.merged.length; i++){
                update = mergeChunkListEcmascriptMergedUpdates(update, updateB.merged[i]);
            }
            merged = [
                update
            ];
        }
    } else if (updateB.merged != null) {
        merged = updateB.merged;
    }
    return {
        type: 'ChunkListUpdate',
        chunks,
        merged
    };
}
function mergeChunkListChunks(chunksA, chunksB) {
    const chunks = {};
    for (const [chunkPath, chunkUpdateA] of Object.entries(chunksA)){
        const chunkUpdateB = chunksB[chunkPath];
        if (chunkUpdateB != null) {
            const mergedUpdate = mergeChunkUpdates(chunkUpdateA, chunkUpdateB);
            if (mergedUpdate != null) {
                chunks[chunkPath] = mergedUpdate;
            }
        } else {
            chunks[chunkPath] = chunkUpdateA;
        }
    }
    for (const [chunkPath, chunkUpdateB] of Object.entries(chunksB)){
        if (chunks[chunkPath] == null) {
            chunks[chunkPath] = chunkUpdateB;
        }
    }
    return chunks;
}
function mergeChunkUpdates(updateA, updateB) {
    if (updateA.type === 'added' && updateB.type === 'deleted' || updateA.type === 'deleted' && updateB.type === 'added') {
        return undefined;
    }
    if (updateB.type === 'total') {
        // A total update replaces the entire chunk, so it supersedes any prior update.
        return updateB;
    }
    if (updateA.type === 'partial') {
        invariant(updateA.instruction, 'Partial updates are unsupported');
    }
    if (updateB.type === 'partial') {
        invariant(updateB.instruction, 'Partial updates are unsupported');
    }
    return undefined;
}
function mergeChunkListEcmascriptMergedUpdates(mergedA, mergedB) {
    const entries = mergeEcmascriptChunkEntries(mergedA.entries, mergedB.entries);
    const chunks = mergeEcmascriptChunksUpdates(mergedA.chunks, mergedB.chunks);
    return {
        type: 'EcmascriptMergedUpdate',
        entries,
        chunks
    };
}
function mergeEcmascriptChunkEntries(entriesA, entriesB) {
    return {
        ...entriesA,
        ...entriesB
    };
}
function mergeEcmascriptChunksUpdates(chunksA, chunksB) {
    if (chunksA == null) {
        return chunksB;
    }
    if (chunksB == null) {
        return chunksA;
    }
    const chunks = {};
    for (const [chunkPath, chunkUpdateA] of Object.entries(chunksA)){
        const chunkUpdateB = chunksB[chunkPath];
        if (chunkUpdateB != null) {
            const mergedUpdate = mergeEcmascriptChunkUpdates(chunkUpdateA, chunkUpdateB);
            if (mergedUpdate != null) {
                chunks[chunkPath] = mergedUpdate;
            }
        } else {
            chunks[chunkPath] = chunkUpdateA;
        }
    }
    for (const [chunkPath, chunkUpdateB] of Object.entries(chunksB)){
        if (chunks[chunkPath] == null) {
            chunks[chunkPath] = chunkUpdateB;
        }
    }
    if (Object.keys(chunks).length === 0) {
        return undefined;
    }
    return chunks;
}
function mergeEcmascriptChunkUpdates(updateA, updateB) {
    if (updateA.type === 'added' && updateB.type === 'deleted') {
        // These two completely cancel each other out.
        return undefined;
    }
    if (updateA.type === 'deleted' && updateB.type === 'added') {
        const added = [];
        const deleted = [];
        const deletedModules = new Set(updateA.modules ?? []);
        const addedModules = new Set(updateB.modules ?? []);
        for (const moduleId of addedModules){
            if (!deletedModules.has(moduleId)) {
                added.push(moduleId);
            }
        }
        for (const moduleId of deletedModules){
            if (!addedModules.has(moduleId)) {
                deleted.push(moduleId);
            }
        }
        if (added.length === 0 && deleted.length === 0) {
            return undefined;
        }
        return {
            type: 'partial',
            added,
            deleted
        };
    }
    if (updateA.type === 'partial' && updateB.type === 'partial') {
        const added = new Set([
            ...updateA.added ?? [],
            ...updateB.added ?? []
        ]);
        const deleted = new Set([
            ...updateA.deleted ?? [],
            ...updateB.deleted ?? []
        ]);
        if (updateB.added != null) {
            for (const moduleId of updateB.added){
                deleted.delete(moduleId);
            }
        }
        if (updateB.deleted != null) {
            for (const moduleId of updateB.deleted){
                added.delete(moduleId);
            }
        }
        return {
            type: 'partial',
            added: [
                ...added
            ],
            deleted: [
                ...deleted
            ]
        };
    }
    if (updateA.type === 'added' && updateB.type === 'partial') {
        const modules = new Set([
            ...updateA.modules ?? [],
            ...updateB.added ?? []
        ]);
        for (const moduleId of updateB.deleted ?? []){
            modules.delete(moduleId);
        }
        return {
            type: 'added',
            modules: [
                ...modules
            ]
        };
    }
    if (updateA.type === 'partial' && updateB.type === 'deleted') {
        // We could eagerly return `updateB` here, but this would potentially be
        // incorrect if `updateA` has added modules.
        const modules = new Set(updateB.modules ?? []);
        if (updateA.added != null) {
            for (const moduleId of updateA.added){
                modules.delete(moduleId);
            }
        }
        return {
            type: 'deleted',
            modules: [
                ...modules
            ]
        };
    }
    // Any other update combination is invalid.
    return undefined;
}
function invariant(_, message) {
    throw new Error(`Invariant: ${message}`);
}
const CRITICAL = [
    'bug',
    'error',
    'fatal'
];
function compareByList(list, a, b) {
    const aI = list.indexOf(a) + 1 || list.length;
    const bI = list.indexOf(b) + 1 || list.length;
    return aI - bI;
}
const chunksWithIssues = new Map();
function emitIssues() {
    const issues = [];
    const deduplicationSet = new Set();
    for (const [_, chunkIssues] of chunksWithIssues){
        for (const chunkIssue of chunkIssues){
            if (deduplicationSet.has(chunkIssue.formatted)) continue;
            issues.push(chunkIssue);
            deduplicationSet.add(chunkIssue.formatted);
        }
    }
    sortIssues(issues);
    hooks.issues(issues);
}
function handleIssues(msg) {
    const key = resourceKey(msg.resource);
    let hasCriticalIssues = false;
    for (const issue of msg.issues){
        if (CRITICAL.includes(issue.severity)) {
            hasCriticalIssues = true;
        }
    }
    if (msg.issues.length > 0) {
        chunksWithIssues.set(key, msg.issues);
    } else if (chunksWithIssues.has(key)) {
        chunksWithIssues.delete(key);
    }
    emitIssues();
    return hasCriticalIssues;
}
const SEVERITY_ORDER = [
    'bug',
    'fatal',
    'error',
    'warning',
    'info',
    'log'
];
const CATEGORY_ORDER = [
    'parse',
    'resolve',
    'code generation',
    'rendering',
    'typescript',
    'other'
];
function sortIssues(issues) {
    issues.sort((a, b)=>{
        const first = compareByList(SEVERITY_ORDER, a.severity, b.severity);
        if (first !== 0) return first;
        return compareByList(CATEGORY_ORDER, a.category, b.category);
    });
}
const hooks = {
    beforeRefresh: ()=>{},
    refresh: ()=>{},
    buildOk: ()=>{},
    issues: (_issues)=>{}
};
function setHooks(newHooks) {
    Object.assign(hooks, newHooks);
}
function handleSocketMessage(msg) {
    sortIssues(msg.issues);
    handleIssues(msg);
    switch(msg.type){
        case 'issues':
            break;
        case 'partial':
            // aggregate updates
            aggregateUpdates(msg);
            break;
        default:
            // run single update
            const runHooks = chunkListsWithPendingUpdates.size === 0;
            if (runHooks) hooks.beforeRefresh();
            triggerUpdate(msg);
            if (runHooks) finalizeUpdate();
            break;
    }
}
function finalizeUpdate() {
    hooks.refresh();
    hooks.buildOk();
    // This is used by the Next.js integration test suite to notify it when HMR
    // updates have been completed.
    // TODO: Only run this in test environments (gate by `process.env.__NEXT_TEST_MODE`)
    if (globalThis.__NEXT_HMR_CB) {
        globalThis.__NEXT_HMR_CB();
        globalThis.__NEXT_HMR_CB = null;
    }
}
function subscribeToChunkUpdate(chunkListPath, sendMessage, callback) {
    return subscribeToUpdate({
        path: chunkListPath
    }, sendMessage, callback);
}
function subscribeToUpdate(resource, sendMessage, callback) {
    const key = resourceKey(resource);
    let callbackSet;
    const existingCallbackSet = updateCallbackSets.get(key);
    if (!existingCallbackSet) {
        callbackSet = {
            callbacks: new Set([
                callback
            ]),
            unsubscribe: subscribeToUpdates(sendMessage, resource)
        };
        updateCallbackSets.set(key, callbackSet);
    } else {
        existingCallbackSet.callbacks.add(callback);
        callbackSet = existingCallbackSet;
    }
    return ()=>{
        callbackSet.callbacks.delete(callback);
        if (callbackSet.callbacks.size === 0) {
            callbackSet.unsubscribe();
            updateCallbackSets.delete(key);
        }
    };
}
function triggerUpdate(msg) {
    const key = resourceKey(msg.resource);
    const callbackSet = updateCallbackSets.get(key);
    if (!callbackSet) {
        return;
    }
    for (const callback of callbackSet.callbacks){
        callback(msg);
    }
    if (msg.type === 'notFound') {
        // This indicates that the resource which we subscribed to either does not exist or
        // has been deleted. In either case, we should clear all update callbacks, so if a
        // new subscription is created for the same resource, it will send a new "subscribe"
        // message to the server.
        // No need to send an "unsubscribe" message to the server, it will have already
        // dropped the update stream before sending the "notFound" message.
        updateCallbackSets.delete(key);
    }
}
}),
"[project]/Desktop/Guildage/pages/index.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/Guildage/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/Guildage/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$next$2f$head$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/Guildage/node_modules/next/head.js [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
const SKILLS = [
    'Florist',
    'Chef',
    'Writer',
    'Coder',
    'Designer',
    'Analyst',
    'Translator',
    'Researcher',
    'Lawyer',
    'Accountant'
];
function Home() {
    _s();
    const [tab, setTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('dashboard');
    const [agents, setAgents] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [activity, setActivity] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])({
        swaps: [],
        borrows: []
    });
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [toast, setToast] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [regName, setRegName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [regOwner, setRegOwner] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [regSkills, setRegSkills] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [regApiKey, setRegApiKey] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [regEndpoint, setRegEndpoint] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('https://api.anthropic.com/v1/messages');
    const [pendingAgent, setPendingAgent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [selectedAgent, setSelectedAgent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [skillNeeded, setSkillNeeded] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [swapResult, setSwapResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [borrowResult, setBorrowResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [taskPrompt, setTaskPrompt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [taskResult, setTaskResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [taskLoading, setTaskLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [activeAccess, setActiveAccess] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const showToast = (msg, type = 'success')=>{
        setToast({
            msg,
            type
        });
        setTimeout(()=>setToast(null), 4000);
    };
    const fetchAgents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[fetchAgents]": async ()=>{
            const r = await fetch('/api/agents');
            const d = await r.json();
            setAgents(d.agents || []);
        }
    }["Home.useCallback[fetchAgents]"], []);
    const fetchActivity = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[fetchActivity]": async ()=>{
            const r = await fetch('/api/activity');
            const d = await r.json();
            setActivity(d);
        }
    }["Home.useCallback[fetchActivity]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Home.useEffect": ()=>{
            fetchAgents();
            fetchActivity();
            const interval = setInterval(fetchAgents, 8000);
            return ({
                "Home.useEffect": ()=>clearInterval(interval)
            })["Home.useEffect"];
        }
    }["Home.useEffect"], [
        fetchAgents,
        fetchActivity
    ]);
    const handleRegister = async ()=>{
        if (!regName || !regOwner || !regSkills.length) {
            showToast('Fill all fields', 'error');
            return;
        }
        setLoading(true);
        const r = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: regName,
                owner_name: regOwner,
                skills: regSkills,
                api_key: regApiKey,
                model_endpoint: regEndpoint
            })
        });
        const d = await r.json();
        setPendingAgent(d);
        setLoading(false);
    };
    const handleConfirmPayment = async ()=>{
        setLoading(true);
        const r = await fetch('/api/confirm-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                agent_id: pendingAgent.agent_id,
                invoice_id: pendingAgent.invoice.invoice_id
            })
        });
        const d = await r.json();
        showToast(d.message);
        setPendingAgent(null);
        setRegName('');
        setRegOwner('');
        setRegSkills([]);
        setRegApiKey('');
        await fetchAgents();
        setTab('dashboard');
        setLoading(false);
    };
    const handleSwap = async ()=>{
        if (!selectedAgent || !skillNeeded) {
            showToast('Select agent and skill', 'error');
            return;
        }
        setLoading(true);
        const r = await fetch('/api/swap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requester_agent_id: selectedAgent,
                skill_needed: skillNeeded
            })
        });
        const d = await r.json();
        if (r.ok) {
            setSwapResult(d);
            setActiveAccess({
                agent_name: d.provider.name,
                skill: skillNeeded,
                api_key: d.provider.api_key,
                model_endpoint: d.provider.model_endpoint
            });
            await fetchActivity();
            await fetchAgents();
        } else showToast(d.error, 'error');
        setLoading(false);
    };
    const handleBorrow = async ()=>{
        if (!selectedAgent || !skillNeeded) {
            showToast('Select agent and skill', 'error');
            return;
        }
        setLoading(true);
        const r = await fetch('/api/borrow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                borrower_agent_id: selectedAgent,
                skill_needed: skillNeeded
            })
        });
        const d = await r.json();
        if (r.status === 402 && d.invoice) {
            setBorrowResult({
                ...d,
                needsPayment: true
            });
        } else if (r.ok) {
            setBorrowResult({
                ...d,
                needsPayment: false
            });
            setActiveAccess({
                agent_name: d.provider.name,
                skill: skillNeeded,
                api_key: d.provider.api_key,
                model_endpoint: d.provider.model_endpoint
            });
            showToast(d.message);
            await fetchAgents();
        } else showToast(d.error, 'error');
        setLoading(false);
    };
    const handleConfirmBorrow = async ()=>{
        setLoading(true);
        const r = await fetch('/api/confirm-borrow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                borrow_id: borrowResult.borrow_id,
                invoice_id: borrowResult.invoice.invoice_id
            })
        });
        const d = await r.json();
        if (r.ok) {
            showToast(d.message);
            setBorrowResult({
                ...d,
                needsPayment: false
            });
            setActiveAccess({
                agent_name: d.provider_name,
                skill: skillNeeded,
                api_key: d.provider?.api_key,
                model_endpoint: d.provider?.model_endpoint
            });
            await fetchActivity();
            await fetchAgents();
        } else showToast(d.error, 'error');
        setLoading(false);
    };
    const handleExecuteTask = async ()=>{
        if (!taskPrompt) {
            showToast('Enter a task', 'error');
            return;
        }
        setTaskLoading(true);
        setTaskResult(null);
        const agentData = agents.find((a)=>a.name === activeAccess?.agent_name);
        const r = await fetch('/api/execute-task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                skill: activeAccess?.skill,
                task_prompt: taskPrompt,
                agent_name: activeAccess?.agent_name,
                api_key: agentData?.api_key || activeAccess?.api_key,
                model_endpoint: agentData?.model_endpoint || activeAccess?.model_endpoint
            })
        });
        const d = await r.json();
        if (r.ok) setTaskResult(d);
        else showToast(d.error, 'error');
        setTaskLoading(false);
    };
    const handleCompleteTask = async (agent_id)=>{
        const tasks = [
            'Analyzed market data',
            'Generated content',
            'Processed request',
            'Reviewed document',
            'Completed consultation'
        ];
        const r = await fetch('/api/complete-task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                agent_id,
                description: tasks[Math.floor(Math.random() * tasks.length)]
            })
        });
        const d = await r.json();
        showToast(`+${d.tokens_earned} tokens earned!`);
        await fetchAgents();
    };
    const toggleSkill = (s)=>setRegSkills((prev)=>prev.includes(s) ? prev.filter((x)=>x !== s) : [
                ...prev,
                s
            ]);
    const tierLabel = (balance)=>{
        if (balance < 500) return {
            label: 'T1',
            color: '#6366f1'
        };
        if (balance < 2000) return {
            label: 'T2',
            color: '#06b6d4'
        };
        return {
            label: 'T3',
            color: '#f59e0b'
        };
    };
    const TaskInterface = ({ agentName, skill })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            style: {
                marginTop: 24,
                background: '#0d0d14',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 12,
                padding: 20
            },
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    style: {
                        fontSize: 12,
                        fontFamily: 'IBM Plex Mono',
                        color: '#10b981',
                        marginBottom: 12
                    },
                    children: [
                        "⚡ ",
                        agentName,
                        " is ready — skill: ",
                        skill
                    ]
                }, void 0, true, {
                    fileName: "[project]/Desktop/Guildage/pages/index.js",
                    lineNumber: 183,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                    value: taskPrompt,
                    onChange: (e)=>setTaskPrompt(e.target.value),
                    placeholder: `Give ${agentName} a task...`,
                    rows: 3,
                    style: {
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 8,
                        fontSize: 14,
                        background: '#12121a',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#f0f0f5',
                        fontFamily: 'IBM Plex Sans, sans-serif',
                        resize: 'vertical',
                        marginBottom: 12
                    }
                }, void 0, false, {
                    fileName: "[project]/Desktop/Guildage/pages/index.js",
                    lineNumber: 186,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: handleExecuteTask,
                    disabled: taskLoading,
                    style: {
                        padding: '10px 20px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        background: '#10b981',
                        color: '#000',
                        border: 'none',
                        fontFamily: 'IBM Plex Mono',
                        opacity: taskLoading ? 0.7 : 1,
                        cursor: 'pointer'
                    },
                    children: taskLoading ? 'Running...' : '▶ Execute Task'
                }, void 0, false, {
                    fileName: "[project]/Desktop/Guildage/pages/index.js",
                    lineNumber: 198,
                    columnNumber: 7
                }, this),
                taskResult && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    style: {
                        marginTop: 16,
                        background: '#12121a',
                        borderRadius: 8,
                        padding: 16,
                        border: '1px solid rgba(255,255,255,0.06)'
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            style: {
                                fontSize: 11,
                                color: '#888899',
                                fontFamily: 'IBM Plex Mono',
                                marginBottom: 8
                            },
                            children: [
                                taskResult.agent_name,
                                " (",
                                taskResult.skill,
                                ") responded:"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                            lineNumber: 207,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            style: {
                                fontSize: 14,
                                lineHeight: 1.7,
                                color: '#f0f0f5',
                                whiteSpace: 'pre-wrap'
                            },
                            children: taskResult.result
                        }, void 0, false, {
                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                            lineNumber: 210,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/Desktop/Guildage/pages/index.js",
                    lineNumber: 206,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/Desktop/Guildage/pages/index.js",
            lineNumber: 182,
            columnNumber: 5
        }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$next$2f$head$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                        children: "Guildage — Agent Bank"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                        lineNumber: 221,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("link", {
                        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap",
                        rel: "stylesheet"
                    }, void 0, false, {
                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                        lineNumber: 222,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/Guildage/pages/index.js",
                lineNumber: 220,
                columnNumber: 7
            }, this),
            toast && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    position: 'fixed',
                    top: 20,
                    right: 20,
                    zIndex: 1000,
                    background: toast.type === 'error' ? '#3f1515' : '#0f2d20',
                    border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#10b981'}`,
                    color: toast.type === 'error' ? '#ef4444' : '#10b981',
                    padding: '12px 20px',
                    borderRadius: 8,
                    fontFamily: 'IBM Plex Mono',
                    fontSize: 13,
                    maxWidth: 360
                },
                children: [
                    toast.type === 'success' ? '✓ ' : '✗ ',
                    toast.msg
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/Guildage/pages/index.js",
                lineNumber: 226,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    minHeight: '100vh',
                    background: '#0a0a0f'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                        style: {
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            padding: '0 32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            height: 60,
                            position: 'sticky',
                            top: 0,
                            zIndex: 100,
                            background: 'rgba(10,10,15,0.95)'
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontFamily: 'IBM Plex Mono',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: '#fff'
                                        },
                                        children: "G"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 246,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        style: {
                                            fontFamily: 'IBM Plex Mono',
                                            fontWeight: 600,
                                            fontSize: 15
                                        },
                                        children: "Guildage"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 252,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        style: {
                                            fontSize: 11,
                                            fontFamily: 'IBM Plex Mono',
                                            color: '#10b981',
                                            background: 'rgba(16,185,129,0.1)',
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            border: '1px solid rgba(16,185,129,0.2)'
                                        },
                                        children: "⚡ Lightning"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 253,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                lineNumber: 245,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                                style: {
                                    display: 'flex',
                                    gap: 4
                                },
                                children: [
                                    'dashboard',
                                    'register',
                                    'swap',
                                    'borrow'
                                ].map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>{
                                            setTab(t);
                                            setSwapResult(null);
                                            setBorrowResult(null);
                                            setTaskResult(null);
                                            setActiveAccess(null);
                                        },
                                        style: {
                                            padding: '6px 16px',
                                            borderRadius: 6,
                                            fontSize: 13,
                                            fontWeight: 500,
                                            background: tab === t ? 'rgba(139,92,246,0.15)' : 'transparent',
                                            color: tab === t ? '#8b5cf6' : '#888899',
                                            border: tab === t ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                                            cursor: 'pointer',
                                            textTransform: 'capitalize'
                                        },
                                        children: t
                                    }, t, false, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 261,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                lineNumber: 259,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                        lineNumber: 239,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                        style: {
                            maxWidth: 1100,
                            margin: '0 auto',
                            padding: '32px 24px'
                        },
                        children: [
                            tab === 'dashboard' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            display: 'flex',
                                            alignItems: 'flex-end',
                                            justifyContent: 'space-between',
                                            marginBottom: 32
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                                        style: {
                                                            fontSize: 28,
                                                            fontWeight: 600,
                                                            fontFamily: 'IBM Plex Mono',
                                                            marginBottom: 6
                                                        },
                                                        children: "Agent Registry"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 278,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        style: {
                                                            color: '#888899',
                                                            fontSize: 14
                                                        },
                                                        children: [
                                                            agents.length,
                                                            " licensed agents · Balances accrue every 8s"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 279,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 277,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: fetchAgents,
                                                style: {
                                                    padding: '9px 18px',
                                                    borderRadius: 7,
                                                    fontSize: 13,
                                                    fontWeight: 500,
                                                    background: 'rgba(139,92,246,0.1)',
                                                    color: '#8b5cf6',
                                                    border: '1px solid rgba(139,92,246,0.3)',
                                                    cursor: 'pointer'
                                                },
                                                children: "↻ Refresh"
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 281,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 276,
                                        columnNumber: 15
                                    }, this),
                                    agents.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            textAlign: 'center',
                                            padding: '80px 20px',
                                            border: '1px dashed rgba(255,255,255,0.08)',
                                            borderRadius: 12,
                                            color: '#888899'
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    fontSize: 40,
                                                    marginBottom: 16
                                                },
                                                children: "🏦"
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 290,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                children: "No agents registered yet. Go to Register tab to add your first agent."
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 291,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 289,
                                        columnNumber: 17
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                            gap: 16
                                        },
                                        children: agents.map((agent)=>{
                                            const tier = tierLabel(agent.token_balance);
                                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    background: '#12121a',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: 12,
                                                    padding: 20,
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            right: 0,
                                                            height: 2,
                                                            background: `linear-gradient(90deg, ${tier.color}, transparent)`
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 299,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'flex-start',
                                                            marginBottom: 14
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        style: {
                                                                            fontWeight: 600,
                                                                            fontSize: 16,
                                                                            fontFamily: 'IBM Plex Mono',
                                                                            marginBottom: 2
                                                                        },
                                                                        children: agent.name
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                        lineNumber: 302,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        style: {
                                                                            fontSize: 12,
                                                                            color: '#888899'
                                                                        },
                                                                        children: [
                                                                            "owned by ",
                                                                            agent.owner_name
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                        lineNumber: 303,
                                                                        columnNumber: 29
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                lineNumber: 301,
                                                                columnNumber: 27
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                style: {
                                                                    fontSize: 11,
                                                                    fontWeight: 600,
                                                                    padding: '3px 8px',
                                                                    borderRadius: 4,
                                                                    background: `${tier.color}20`,
                                                                    color: tier.color,
                                                                    border: `1px solid ${tier.color}40`,
                                                                    fontFamily: 'IBM Plex Mono'
                                                                },
                                                                children: tier.label
                                                            }, void 0, false, {
                                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                lineNumber: 305,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 300,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            display: 'flex',
                                                            gap: 8,
                                                            flexWrap: 'wrap',
                                                            marginBottom: 16
                                                        },
                                                        children: agent.skills.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                style: {
                                                                    fontSize: 11,
                                                                    padding: '3px 10px',
                                                                    borderRadius: 20,
                                                                    background: 'rgba(139,92,246,0.1)',
                                                                    color: '#8b5cf6',
                                                                    border: '1px solid rgba(139,92,246,0.2)'
                                                                },
                                                                children: s
                                                            }, s, false, {
                                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                lineNumber: 309,
                                                                columnNumber: 29
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 307,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            display: 'grid',
                                                            gridTemplateColumns: '1fr 1fr',
                                                            gap: 8,
                                                            marginBottom: 14
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                style: {
                                                                    background: '#1a1a24',
                                                                    borderRadius: 8,
                                                                    padding: '10px 12px'
                                                                },
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        style: {
                                                                            fontSize: 11,
                                                                            color: '#888899',
                                                                            marginBottom: 3,
                                                                            fontFamily: 'IBM Plex Mono'
                                                                        },
                                                                        children: "TOKENS"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                        lineNumber: 314,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        style: {
                                                                            fontSize: 18,
                                                                            fontWeight: 600,
                                                                            color: '#f59e0b',
                                                                            fontFamily: 'IBM Plex Mono'
                                                                        },
                                                                        children: agent.token_balance.toFixed(1)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                        lineNumber: 315,
                                                                        columnNumber: 29
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                lineNumber: 313,
                                                                columnNumber: 27
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                style: {
                                                                    background: '#1a1a24',
                                                                    borderRadius: 8,
                                                                    padding: '10px 12px'
                                                                },
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        style: {
                                                                            fontSize: 11,
                                                                            color: '#888899',
                                                                            marginBottom: 3,
                                                                            fontFamily: 'IBM Plex Mono'
                                                                        },
                                                                        children: "TASKS"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                        lineNumber: 318,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        style: {
                                                                            fontSize: 18,
                                                                            fontWeight: 600,
                                                                            color: '#10b981',
                                                                            fontFamily: 'IBM Plex Mono'
                                                                        },
                                                                        children: agent.task_count
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                        lineNumber: 319,
                                                                        columnNumber: 29
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                lineNumber: 317,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 312,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: ()=>handleCompleteTask(agent.id),
                                                        style: {
                                                            width: '100%',
                                                            padding: '8px',
                                                            borderRadius: 7,
                                                            fontSize: 12,
                                                            fontWeight: 500,
                                                            background: 'rgba(16,185,129,0.08)',
                                                            color: '#10b981',
                                                            border: '1px solid rgba(16,185,129,0.2)',
                                                            cursor: 'pointer',
                                                            fontFamily: 'IBM Plex Mono'
                                                        },
                                                        children: "+ Complete Task"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 322,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, agent.id, true, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 298,
                                                columnNumber: 23
                                            }, this);
                                        })
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 294,
                                        columnNumber: 17
                                    }, this),
                                    (activity.swaps.length > 0 || activity.borrows.length > 0) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            marginTop: 40
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                style: {
                                                    fontSize: 16,
                                                    fontWeight: 600,
                                                    fontFamily: 'IBM Plex Mono',
                                                    marginBottom: 16,
                                                    color: '#888899'
                                                },
                                                children: "ACTIVITY LOG"
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 335,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr 1fr',
                                                    gap: 16
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                style: {
                                                                    fontSize: 12,
                                                                    color: '#888899',
                                                                    marginBottom: 10,
                                                                    fontFamily: 'IBM Plex Mono'
                                                                },
                                                                children: "SWAPS (FREE)"
                                                            }, void 0, false, {
                                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                lineNumber: 338,
                                                                columnNumber: 23
                                                            }, this),
                                                            activity.swaps.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    style: {
                                                                        background: '#12121a',
                                                                        border: '1px solid rgba(139,92,246,0.15)',
                                                                        borderRadius: 8,
                                                                        padding: '10px 14px',
                                                                        marginBottom: 8,
                                                                        fontSize: 13
                                                                    },
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            style: {
                                                                                color: '#8b5cf6',
                                                                                fontFamily: 'IBM Plex Mono'
                                                                            },
                                                                            children: s.requester_name
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                            lineNumber: 341,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            style: {
                                                                                color: '#888899'
                                                                            },
                                                                            children: " ↔ "
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                            lineNumber: 342,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            style: {
                                                                                color: '#06b6d4',
                                                                                fontFamily: 'IBM Plex Mono'
                                                                            },
                                                                            children: s.provider_name
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                            lineNumber: 343,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            style: {
                                                                                fontSize: 11,
                                                                                color: '#888899',
                                                                                marginTop: 3
                                                                            },
                                                                            children: [
                                                                                "skill: ",
                                                                                s.skill_requested
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                            lineNumber: 344,
                                                                            columnNumber: 27
                                                                        }, this)
                                                                    ]
                                                                }, s.id, true, {
                                                                    fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                    lineNumber: 340,
                                                                    columnNumber: 25
                                                                }, this))
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 337,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                style: {
                                                                    fontSize: 12,
                                                                    color: '#888899',
                                                                    marginBottom: 10,
                                                                    fontFamily: 'IBM Plex Mono'
                                                                },
                                                                children: "BORROWS (PAID)"
                                                            }, void 0, false, {
                                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                lineNumber: 349,
                                                                columnNumber: 23
                                                            }, this),
                                                            activity.borrows.map((b)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    style: {
                                                                        background: '#12121a',
                                                                        border: '1px solid rgba(245,158,11,0.15)',
                                                                        borderRadius: 8,
                                                                        padding: '10px 14px',
                                                                        marginBottom: 8,
                                                                        fontSize: 13
                                                                    },
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            style: {
                                                                                color: '#f59e0b',
                                                                                fontFamily: 'IBM Plex Mono'
                                                                            },
                                                                            children: b.borrower_name
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                            lineNumber: 352,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            style: {
                                                                                color: '#888899'
                                                                            },
                                                                            children: " → "
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                            lineNumber: 353,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            style: {
                                                                                fontFamily: 'IBM Plex Mono'
                                                                            },
                                                                            children: b.provider_name
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                            lineNumber: 354,
                                                                            columnNumber: 27
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            style: {
                                                                                fontSize: 11,
                                                                                color: '#888899',
                                                                                marginTop: 3
                                                                            },
                                                                            children: [
                                                                                b.tokens_paid,
                                                                                " tokens · ",
                                                                                b.skill_requested
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                            lineNumber: 355,
                                                                            columnNumber: 27
                                                                        }, this)
                                                                    ]
                                                                }, b.id, true, {
                                                                    fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                    lineNumber: 351,
                                                                    columnNumber: 25
                                                                }, this))
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 348,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 336,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 334,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                lineNumber: 275,
                                columnNumber: 13
                            }, this),
                            tab === 'register' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    maxWidth: 520
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                        style: {
                                            fontSize: 24,
                                            fontWeight: 600,
                                            fontFamily: 'IBM Plex Mono',
                                            marginBottom: 8
                                        },
                                        children: "Register Agent"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 367,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        style: {
                                            color: '#888899',
                                            fontSize: 14,
                                            marginBottom: 32
                                        },
                                        children: "Pay 100 sats via Lightning to mint your agent in Guildage"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 368,
                                        columnNumber: 15
                                    }, this),
                                    !pendingAgent ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 16
                                        },
                                        children: [
                                            [
                                                {
                                                    label: 'AGENT NAME',
                                                    value: regName,
                                                    set: setRegName,
                                                    placeholder: 'e.g. Story Spark'
                                                },
                                                {
                                                    label: 'OWNER NAME',
                                                    value: regOwner,
                                                    set: setRegOwner,
                                                    placeholder: 'Your name'
                                                },
                                                {
                                                    label: 'API KEY',
                                                    value: regApiKey,
                                                    set: setRegApiKey,
                                                    placeholder: 'sk-ant-... or sk-... (your model API key)',
                                                    type: 'password'
                                                },
                                                {
                                                    label: 'MODEL ENDPOINT (optional)',
                                                    value: regEndpoint,
                                                    set: setRegEndpoint,
                                                    placeholder: 'https://api.anthropic.com/v1/messages'
                                                }
                                            ].map(({ label, value, set, placeholder, type })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            style: {
                                                                display: 'block',
                                                                fontSize: 12,
                                                                fontFamily: 'IBM Plex Mono',
                                                                color: '#888899',
                                                                marginBottom: 8
                                                            },
                                                            children: label
                                                        }, void 0, false, {
                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                            lineNumber: 379,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            type: type || 'text',
                                                            value: value,
                                                            onChange: (e)=>set(e.target.value),
                                                            placeholder: placeholder,
                                                            style: {
                                                                width: '100%',
                                                                padding: '10px 14px',
                                                                borderRadius: 8,
                                                                fontSize: 14,
                                                                background: '#12121a',
                                                                border: '1px solid rgba(255,255,255,0.08)',
                                                                color: '#f0f0f5',
                                                                fontFamily: 'IBM Plex Mono'
                                                            }
                                                        }, void 0, false, {
                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                            lineNumber: 380,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, label, true, {
                                                    fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                    lineNumber: 378,
                                                    columnNumber: 21
                                                }, this)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        style: {
                                                            display: 'block',
                                                            fontSize: 12,
                                                            fontFamily: 'IBM Plex Mono',
                                                            color: '#888899',
                                                            marginBottom: 10
                                                        },
                                                        children: "SKILLS"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 388,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            display: 'flex',
                                                            flexWrap: 'wrap',
                                                            gap: 8
                                                        },
                                                        children: SKILLS.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: ()=>toggleSkill(s),
                                                                style: {
                                                                    padding: '6px 14px',
                                                                    borderRadius: 20,
                                                                    fontSize: 13,
                                                                    fontWeight: 500,
                                                                    background: regSkills.includes(s) ? 'rgba(139,92,246,0.2)' : '#12121a',
                                                                    color: regSkills.includes(s) ? '#8b5cf6' : '#888899',
                                                                    border: regSkills.includes(s) ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                                                                    cursor: 'pointer'
                                                                },
                                                                children: s
                                                            }, s, false, {
                                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                lineNumber: 391,
                                                                columnNumber: 25
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 389,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 387,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: handleRegister,
                                                disabled: loading,
                                                style: {
                                                    marginTop: 8,
                                                    padding: '12px',
                                                    borderRadius: 8,
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                                                    color: '#fff',
                                                    border: 'none',
                                                    fontFamily: 'IBM Plex Mono',
                                                    cursor: 'pointer',
                                                    opacity: loading ? 0.7 : 1
                                                },
                                                children: loading ? 'Generating Invoice...' : '⚡ Generate Lightning Invoice'
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 401,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 371,
                                        columnNumber: 17
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            background: '#12121a',
                                            border: '1px solid rgba(245,158,11,0.3)',
                                            borderRadius: 12,
                                            padding: 24
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    fontSize: 12,
                                                    fontFamily: 'IBM Plex Mono',
                                                    color: '#f59e0b',
                                                    marginBottom: 16
                                                },
                                                children: "⚡ LIGHTNING INVOICE READY"
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 409,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    fontSize: 28,
                                                    fontWeight: 600,
                                                    fontFamily: 'IBM Plex Mono',
                                                    color: '#f59e0b',
                                                    marginBottom: 4
                                                },
                                                children: [
                                                    pendingAgent.deposit_sats,
                                                    " sats"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 410,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    fontSize: 12,
                                                    color: '#888899',
                                                    marginTop: 4,
                                                    marginBottom: 16
                                                },
                                                children: [
                                                    "→ ",
                                                    pendingAgent.starting_tokens,
                                                    " tokens on activation"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 411,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    background: '#0a0a0f',
                                                    borderRadius: 8,
                                                    padding: '10px 14px',
                                                    fontFamily: 'IBM Plex Mono',
                                                    fontSize: 11,
                                                    color: '#888899',
                                                    wordBreak: 'break-all',
                                                    marginBottom: 16,
                                                    border: '1px solid rgba(255,255,255,0.06)'
                                                },
                                                children: pendingAgent.invoice.bolt11
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 412,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: handleConfirmPayment,
                                                disabled: loading,
                                                style: {
                                                    width: '100%',
                                                    padding: '12px',
                                                    borderRadius: 8,
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    background: '#10b981',
                                                    color: '#fff',
                                                    border: 'none',
                                                    fontFamily: 'IBM Plex Mono',
                                                    cursor: 'pointer',
                                                    opacity: loading ? 0.7 : 1
                                                },
                                                children: loading ? 'Confirming...' : '✓ Confirm Payment & Activate Agent'
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 415,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                style: {
                                                    fontSize: 11,
                                                    color: '#888899',
                                                    marginTop: 10,
                                                    textAlign: 'center'
                                                },
                                                children: "Demo mode: Lightning payment auto-confirmed"
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 419,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 408,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                lineNumber: 366,
                                columnNumber: 13
                            }, this),
                            tab === 'swap' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    maxWidth: 560
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                        style: {
                                            fontSize: 24,
                                            fontWeight: 600,
                                            fontFamily: 'IBM Plex Mono',
                                            marginBottom: 8
                                        },
                                        children: "Skill Swap"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 427,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        style: {
                                            color: '#888899',
                                            fontSize: 14,
                                            marginBottom: 28
                                        },
                                        children: "Free — your agent serves the provider's owner in return"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 428,
                                        columnNumber: 15
                                    }, this),
                                    !swapResult ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 16
                                        },
                                        children: [
                                            [
                                                {
                                                    label: 'YOUR AGENT',
                                                    val: selectedAgent,
                                                    set: setSelectedAgent,
                                                    opts: agents.map((a)=>({
                                                            v: a.id,
                                                            l: `${a.name} (${a.owner_name})`
                                                        }))
                                                },
                                                {
                                                    label: 'SKILL NEEDED',
                                                    val: skillNeeded,
                                                    set: setSkillNeeded,
                                                    opts: SKILLS.map((s)=>({
                                                            v: s,
                                                            l: s
                                                        }))
                                                }
                                            ].map(({ label, val, set, opts })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            style: {
                                                                display: 'block',
                                                                fontSize: 12,
                                                                fontFamily: 'IBM Plex Mono',
                                                                color: '#888899',
                                                                marginBottom: 8
                                                            },
                                                            children: label
                                                        }, void 0, false, {
                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                            lineNumber: 437,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                            value: val,
                                                            onChange: (e)=>set(e.target.value),
                                                            style: {
                                                                width: '100%',
                                                                padding: '10px 14px',
                                                                borderRadius: 8,
                                                                fontSize: 14,
                                                                background: '#12121a',
                                                                border: '1px solid rgba(255,255,255,0.08)',
                                                                color: val ? '#f0f0f5' : '#888899',
                                                                fontFamily: 'IBM Plex Mono'
                                                            },
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                    value: "",
                                                                    children: "Select..."
                                                                }, void 0, false, {
                                                                    fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                    lineNumber: 439,
                                                                    columnNumber: 25
                                                                }, this),
                                                                opts.map((o)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                        value: o.v,
                                                                        children: o.l
                                                                    }, o.v, false, {
                                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                        lineNumber: 440,
                                                                        columnNumber: 40
                                                                    }, this))
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                            lineNumber: 438,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, label, true, {
                                                    fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                    lineNumber: 436,
                                                    columnNumber: 21
                                                }, this)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: handleSwap,
                                                disabled: loading,
                                                style: {
                                                    padding: '12px',
                                                    borderRadius: 8,
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    background: 'rgba(139,92,246,0.15)',
                                                    color: '#8b5cf6',
                                                    border: '1px solid rgba(139,92,246,0.4)',
                                                    fontFamily: 'IBM Plex Mono',
                                                    cursor: 'pointer',
                                                    opacity: loading ? 0.7 : 1
                                                },
                                                children: loading ? 'Matching...' : '⟳ Request Swap — FREE'
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 444,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 431,
                                        columnNumber: 17
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    background: '#12121a',
                                                    border: '1px solid rgba(139,92,246,0.3)',
                                                    borderRadius: 12,
                                                    padding: 24
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            fontSize: 12,
                                                            fontFamily: 'IBM Plex Mono',
                                                            color: '#8b5cf6',
                                                            marginBottom: 16
                                                        },
                                                        children: "✓ SWAP ACTIVE"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 451,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            fontSize: 18,
                                                            fontWeight: 600,
                                                            fontFamily: 'IBM Plex Mono',
                                                            marginBottom: 4
                                                        },
                                                        children: swapResult.provider.name
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 452,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            fontSize: 13,
                                                            color: '#888899',
                                                            marginBottom: 16
                                                        },
                                                        children: [
                                                            "owned by ",
                                                            swapResult.provider.owner_name
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 453,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            background: 'rgba(139,92,246,0.08)',
                                                            border: '1px solid rgba(139,92,246,0.2)',
                                                            borderRadius: 8,
                                                            padding: '12px 16px',
                                                            marginBottom: 16,
                                                            fontSize: 13
                                                        },
                                                        children: [
                                                            "⟳ ",
                                                            swapResult.requester_obligation
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 454,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            fontSize: 20,
                                                            fontWeight: 700,
                                                            color: '#10b981',
                                                            fontFamily: 'IBM Plex Mono'
                                                        },
                                                        children: "COST: FREE"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 457,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 450,
                                                columnNumber: 19
                                            }, this),
                                            activeAccess && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TaskInterface, {
                                                agentName: activeAccess.agent_name,
                                                skill: activeAccess.skill
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 459,
                                                columnNumber: 36
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>{
                                                    setSwapResult(null);
                                                    setSelectedAgent('');
                                                    setSkillNeeded('');
                                                    setTaskResult(null);
                                                    setActiveAccess(null);
                                                },
                                                style: {
                                                    marginTop: 16,
                                                    width: '100%',
                                                    padding: '10px',
                                                    borderRadius: 7,
                                                    fontSize: 13,
                                                    background: 'transparent',
                                                    color: '#888899',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    cursor: 'pointer',
                                                    fontFamily: 'IBM Plex Mono'
                                                },
                                                children: "New Swap"
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 460,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 449,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                lineNumber: 426,
                                columnNumber: 13
                            }, this),
                            tab === 'borrow' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    maxWidth: 560
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                        style: {
                                            fontSize: 24,
                                            fontWeight: 600,
                                            fontFamily: 'IBM Plex Mono',
                                            marginBottom: 8
                                        },
                                        children: "Borrow Skill"
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 468,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        style: {
                                            color: '#888899',
                                            fontSize: 14,
                                            marginBottom: 28
                                        },
                                        children: "Pay with tokens or Lightning sats. Get an L402 access token."
                                    }, void 0, false, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 469,
                                        columnNumber: 15
                                    }, this),
                                    !borrowResult ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 16
                                        },
                                        children: [
                                            [
                                                {
                                                    label: 'YOUR AGENT',
                                                    val: selectedAgent,
                                                    set: setSelectedAgent,
                                                    opts: agents.map((a)=>({
                                                            v: a.id,
                                                            l: `${a.name} — ${a.token_balance.toFixed(0)} tokens`
                                                        }))
                                                },
                                                {
                                                    label: 'SKILL NEEDED',
                                                    val: skillNeeded,
                                                    set: setSkillNeeded,
                                                    opts: SKILLS.map((s)=>({
                                                            v: s,
                                                            l: s
                                                        }))
                                                }
                                            ].map(({ label, val, set, opts })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            style: {
                                                                display: 'block',
                                                                fontSize: 12,
                                                                fontFamily: 'IBM Plex Mono',
                                                                color: '#888899',
                                                                marginBottom: 8
                                                            },
                                                            children: label
                                                        }, void 0, false, {
                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                            lineNumber: 478,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                            value: val,
                                                            onChange: (e)=>set(e.target.value),
                                                            style: {
                                                                width: '100%',
                                                                padding: '10px 14px',
                                                                borderRadius: 8,
                                                                fontSize: 14,
                                                                background: '#12121a',
                                                                border: '1px solid rgba(255,255,255,0.08)',
                                                                color: val ? '#f0f0f5' : '#888899',
                                                                fontFamily: 'IBM Plex Mono'
                                                            },
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                    value: "",
                                                                    children: "Select..."
                                                                }, void 0, false, {
                                                                    fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                    lineNumber: 480,
                                                                    columnNumber: 25
                                                                }, this),
                                                                opts.map((o)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                        value: o.v,
                                                                        children: o.l
                                                                    }, o.v, false, {
                                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                                        lineNumber: 481,
                                                                        columnNumber: 40
                                                                    }, this))
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                            lineNumber: 479,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, label, true, {
                                                    fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                    lineNumber: 477,
                                                    columnNumber: 21
                                                }, this)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: handleBorrow,
                                                disabled: loading,
                                                style: {
                                                    padding: '12px',
                                                    borderRadius: 8,
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    background: 'rgba(245,158,11,0.12)',
                                                    color: '#f59e0b',
                                                    border: '1px solid rgba(245,158,11,0.35)',
                                                    fontFamily: 'IBM Plex Mono',
                                                    cursor: 'pointer',
                                                    opacity: loading ? 0.7 : 1
                                                },
                                                children: loading ? 'Processing...' : '⚡ Request Borrow'
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 485,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 472,
                                        columnNumber: 17
                                    }, this) : borrowResult.needsPayment ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            background: '#12121a',
                                            border: '1px solid rgba(245,158,11,0.3)',
                                            borderRadius: 12,
                                            padding: 24
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    fontSize: 12,
                                                    fontFamily: 'IBM Plex Mono',
                                                    color: '#f59e0b',
                                                    marginBottom: 16
                                                },
                                                children: "⚡ LIGHTNING PAYMENT REQUIRED"
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 491,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    fontSize: 28,
                                                    fontWeight: 700,
                                                    fontFamily: 'IBM Plex Mono',
                                                    color: '#f59e0b',
                                                    marginBottom: 4
                                                },
                                                children: [
                                                    borrowResult.amount_sats,
                                                    " sats"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 492,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    fontSize: 13,
                                                    color: '#888899',
                                                    marginBottom: 16
                                                },
                                                children: [
                                                    "Borrow ",
                                                    skillNeeded,
                                                    " from ",
                                                    borrowResult.provider.name
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 493,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    background: '#0a0a0f',
                                                    borderRadius: 8,
                                                    padding: '10px 14px',
                                                    fontFamily: 'IBM Plex Mono',
                                                    fontSize: 11,
                                                    color: '#888899',
                                                    wordBreak: 'break-all',
                                                    marginBottom: 16,
                                                    border: '1px solid rgba(255,255,255,0.06)'
                                                },
                                                children: borrowResult.invoice.bolt11
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 494,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: handleConfirmBorrow,
                                                disabled: loading,
                                                style: {
                                                    width: '100%',
                                                    padding: '12px',
                                                    borderRadius: 8,
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    background: '#f59e0b',
                                                    color: '#000',
                                                    border: 'none',
                                                    fontFamily: 'IBM Plex Mono',
                                                    cursor: 'pointer',
                                                    opacity: loading ? 0.7 : 1
                                                },
                                                children: loading ? 'Confirming...' : '✓ Confirm Lightning Payment'
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 497,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 490,
                                        columnNumber: 17
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    background: '#12121a',
                                                    border: '1px solid rgba(16,185,129,0.3)',
                                                    borderRadius: 12,
                                                    padding: 24
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            fontSize: 12,
                                                            fontFamily: 'IBM Plex Mono',
                                                            color: '#10b981',
                                                            marginBottom: 16
                                                        },
                                                        children: "✓ ACCESS GRANTED"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 504,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            fontSize: 13,
                                                            color: '#888899',
                                                            marginBottom: 8
                                                        },
                                                        children: "L402 ACCESS TOKEN"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 505,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        style: {
                                                            background: '#0a0a0f',
                                                            borderRadius: 8,
                                                            padding: '10px 14px',
                                                            fontFamily: 'IBM Plex Mono',
                                                            fontSize: 11,
                                                            color: '#10b981',
                                                            wordBreak: 'break-all',
                                                            marginBottom: 16,
                                                            border: '1px solid rgba(16,185,129,0.2)'
                                                        },
                                                        children: borrowResult.access_token || 'Token issued'
                                                    }, void 0, false, {
                                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                        lineNumber: 506,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 503,
                                                columnNumber: 19
                                            }, this),
                                            activeAccess && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TaskInterface, {
                                                agentName: activeAccess.agent_name,
                                                skill: activeAccess.skill
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 510,
                                                columnNumber: 36
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$Guildage$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>{
                                                    setBorrowResult(null);
                                                    setSelectedAgent('');
                                                    setSkillNeeded('');
                                                    setTaskResult(null);
                                                    setActiveAccess(null);
                                                },
                                                style: {
                                                    marginTop: 16,
                                                    width: '100%',
                                                    padding: '10px',
                                                    borderRadius: 7,
                                                    fontSize: 13,
                                                    background: 'transparent',
                                                    color: '#888899',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    cursor: 'pointer',
                                                    fontFamily: 'IBM Plex Mono'
                                                },
                                                children: "New Borrow"
                                            }, void 0, false, {
                                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                                lineNumber: 511,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                                        lineNumber: 502,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Desktop/Guildage/pages/index.js",
                                lineNumber: 467,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Desktop/Guildage/pages/index.js",
                        lineNumber: 272,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Desktop/Guildage/pages/index.js",
                lineNumber: 238,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_s(Home, "EpcVokBk4BeHgZFNaej2hoP2biU=");
_c = Home;
var _c;
__turbopack_context__.k.register(_c, "Home");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[next]/entry/page-loader.ts { PAGE => \"[project]/Desktop/Guildage/pages/index.js [client] (ecmascript)\" } [client] (ecmascript)", ((__turbopack_context__, module, exports) => {

const PAGE_PATH = "/";
(window.__NEXT_P = window.__NEXT_P || []).push([
    PAGE_PATH,
    ()=>{
        return __turbopack_context__.r("[project]/Desktop/Guildage/pages/index.js [client] (ecmascript)");
    }
]);
// @ts-expect-error module.hot exists
if ("TURBOPACK compile-time truthy", 1) {
    // @ts-expect-error module.hot exists
    module.hot.dispose(function() {
        window.__NEXT_P.push([
            PAGE_PATH
        ]);
    });
}
}),
"[hmr-entry]/hmr-entry.js { ENTRY => \"[project]/Desktop/Guildage/pages/index\" }", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.r("[next]/entry/page-loader.ts { PAGE => \"[project]/Desktop/Guildage/pages/index.js [client] (ecmascript)\" } [client] (ecmascript)");
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__090c40d._.js.map