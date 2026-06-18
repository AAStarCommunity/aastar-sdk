import { AirAccountClient, YAAAClient } from "../src";

// Basic import test — verify both the current name and the deprecated alias.
try {
  console.log("Checking exports...");
  if (AirAccountClient) {
    console.log("AirAccountClient exported successfully");
  } else {
    throw new Error("AirAccountClient export failed");
  }
  if (YAAAClient && YAAAClient === AirAccountClient) {
    console.log("YAAAClient deprecated alias exported successfully");
  } else {
    throw new Error("YAAAClient deprecated alias export failed");
  }
  console.log("SDK build verification passed!");
} catch (error) {
  console.error("Verification failed:", error);
  process.exit(1);
}
