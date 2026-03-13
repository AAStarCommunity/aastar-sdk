import { YAAAClient } from "../src";

// Basic import test
try {
  console.log("Checking exports...");
  if (YAAAClient) {
    console.log("YAAAClient exported successfully");
  } else {
    throw new Error("YAAAClient export failed");
  }
  console.log("SDK build verification passed!");
} catch (error) {
  console.error("Verification failed:", error);
  process.exit(1);
}
