#!/usr/bin/env node
import { ping } from "./index.js";

const command = process.argv[2];

if (command === "ping" || command === "--ping") {
  console.log(ping());
} else {
  console.log(ping());
}
