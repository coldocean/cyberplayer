import { handle } from "hono/vercel";
import app from "../packages/web/src/api/index";

export const runtime = "nodejs";

export default handle(app);
