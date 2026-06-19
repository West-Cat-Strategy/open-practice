import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { withDockerLocalDevEnv } from "./run-e2e.mjs";

describe("run-e2e Docker-local web environment", () => {
  it("marks Docker-local browser flows for same-origin web API routing", () => {
    assert.deepEqual(
      withDockerLocalDevEnv({
        API_BASE_URL: "http://localhost:34120",
        OPEN_PRACTICE_DOCKER_LOCAL_DEV: "false",
      }),
      {
        API_BASE_URL: "http://localhost:34120",
        OPEN_PRACTICE_DOCKER_LOCAL_DEV: "true",
      },
    );
  });
});
