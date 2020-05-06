import http from "http";

import { EndpointError } from "./EndpointError";
import { EndpointErrors } from "./EndpointErrors";
import { Request } from "./Request";
import { Router } from "./Router";

export class RouterServer {
    router: Router;
    server?: http.Server;

    constructor(router: Router) {
        this.router = router;
    }

    async requestListener(req: http.IncomingMessage, res: http.ServerResponse) {
        let request: Request;
        try {
            request = Request.fromHttp(req);
        } catch (e) {
            console.error(e);
            res.end();
            return;
        }

        try {
            const response = await this.router.run(request);
            if (!response) {
                res.writeHead(404);
                res.end("Endpoint not found.");
            } else {
                if (!response.headers["Cache-Control"]) response.headers["Cache-Control"] = "no-cache";
                res.writeHead(response.status, response.headers);
                res.end(response.body);
            }
        } catch (e) {
            // Todo: implement special errors to send custom status codes
            if (e instanceof EndpointError) {
                res.writeHead(e.statusCode ?? 400, {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                });
                res.end(JSON.stringify(new EndpointErrors(e)));
            } else if (e instanceof EndpointErrors) {
                res.writeHead(e.statusCode ?? 400, {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                });
                res.end(JSON.stringify(e));
            } else {
                res.writeHead(500, {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                });
                // Todo: hide information if not running in development mode
                res.end(
                    JSON.stringify({
                        errors: [
                            {
                                code: "internal_error",
                                message: e.message,
                            },
                        ],
                    })
                );

                console.error(e);
            }

            return;
        }
    }

    listen(port: number) {
        if (this.server) {
            throw new Error("Already listening.");
        }
        console.log("Starting server...");
        this.server = http.createServer(this.requestListener.bind(this));
        this.server.listen(port, "0.0.0.0", () => {
            console.log("Server running at http://0.0.0.0:" + port);
        });
    }

    async close(): Promise<Error | undefined> {
        console.log("Stoppping server...");
        return new Promise((resolve, reject) => {
            if (!this.server) {
                throw new Error("Already stopped.");
            }
            this.server.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
            this.server = undefined;
        });
    }
}
