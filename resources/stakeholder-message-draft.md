Great! I reviewed this workshop agenda. I think we can go ahead like this and cover meaningful territory in 4 hours.

My proposal is a slight modification of yours — mainly splitting out the Hello World as a demo, adding a mock BAF server for Hour 3, and dropping the Vercel AI SDK from the dispute resolution hour (since BafAgentClient doesn't use it). We can discuss, too but I'm looking to get most of this done by Tuesday this coming week as I'm a bit short of time.

**Hour 1:** Format: Presentation. Intro to durability. BTP dispute agent's durability challenges. Intro to Temporal.

**Hour 2:** Format: Presentation + hands-on. Temporal TypeScript hello world as a pre-made demo — breakdown of workflow/activity/worker/client components, the UI etc. Then hands-on: Temporal + Vercel AI SDK integration. Haiku agent for simple durable LLM calls, then durable agent with tools (e.g. weather). Purpose is to get devs familiar with Temporal for AI and our integrations. Using LiteLLM or the SAP adapter as model provider.

**Hour 3:** Format: Hands-on with pre-made repo. Modified BTP Dispute Agent that is a Temporal workflow, with a mocked BAF server (configurable — can point at real BAF if participants have access). Showing the polling pattern and how it's durable in the face of crashes and API downtime. This hour doesn't use the Vercel AI SDK as the BTP Dispute Agent doesn't — it's pure durable orchestration of the existing HTTP polling pattern.

**Hour 4:** Format: Presentation, Q&A discussion. Integrating / operating Temporal, service integration vision, Joule core durability.

Hours 2 and 3 will likely take the majority of the time — fine to split into "hours" like this for now and flex on the day.
