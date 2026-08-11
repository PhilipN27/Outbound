#!/usr/bin/env node
import "./suppress-sqlite-warning.js";
import { cliMain } from "./cli-main.js";

const { exitCode, output } = cliMain(process.argv.slice(2));
console.log(output);
process.exitCode = exitCode;
