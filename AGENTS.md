# Autonomous Agent Execution Protocol

## Execution Guidelines
1. **Full End-to-End Autonomous Execution**:
   - When the user gives a prompt or task, execute the entire task completely from start to finish without pausing to ask for intermediate confirmations.
   - Do not ask trivial or rhetorical questions. If the user's intent is clear, proceed immediately with the implementation.
   - Make all required code changes, edits, test builds (`npm.cmd run build`), and verify everything in one seamless run.

2. **Tool and Command Execution**:
   - Always proceed with necessary tool executions (terminal commands, file writes, edits) autonomously to fulfill the user's request.
   - Do not wait or break execution into multiple conversational rounds unless an external input is strictly mandatory and cannot be inferred.

3. **Deliver Complete Results**:
   - Once all actions, builds, and verifications are done, provide a concise, clear final report of what was completed.
