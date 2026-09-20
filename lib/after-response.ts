import { after } from "next/server";

/**
 * Run work after the response has gone out.
 *
 * Inside a Next request this is `after()`: the reply is sent first and the
 * work runs behind it. A mail send is a round-trip to an SMTP host we do not
 * control, and it has held a request for seventeen seconds — on a phone that
 * reads as hung, and that is exactly when someone closes the tab.
 *
 * Outside a request scope — tests calling the handler directly, or a script —
 * `after()` throws, and the honest degradation is simply to run the work now.
 * That is not a test-only shim: it is what "there is no response to wait for"
 * should mean. Any other failure to schedule is a real error and is rethrown.
 */
export async function runAfterResponse(fn: () => Promise<void>): Promise<void> {
  try {
    after(fn);
  } catch (e) {
    if (/request scope/i.test(String((e as Error)?.message))) {
      await fn();
      return;
    }
    throw e;
  }
}
