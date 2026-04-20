#!/usr/bin/env bun
import { OnpeClient, OnpeError } from "./client";
import { emit, note, reportError } from "./cli/agent/json-mode";
import { emitNextSteps } from "./cli/agent/next-steps";
import { type GlobalFlags, parseGlobalFlags } from "./cli/foundation/global-flags";
import { AppError, mapError } from "./cli/foundation/error-map";
import { ONPE_ERRORS } from "./errors";
import { renderActa, renderDoctor, renderMesa, renderResumen, renderUbigeos } from "./format";

const HELP = `onpe - Agent-first CLI for ONPE election data

USAGE
  onpe <command> [options]

COMMANDS
  doctor                     Check API connectivity and status
  mesa <codigo>              Look up a mesa by code (e.g. 000001, 900001)
  acta <id>                  Get full acta detail by numeric ID
  resumen                    Get general election summary
  ubigeos [nivel] [padre]    List ubigeos (nivel: 1=dept, 2=prov, 3=dist)
  file-url <fileId>          Get download URL for an acta file

FLAGS
  --json                     Emit JSON for agents (auto when piped)
  --quiet                    Suppress non-essential output
  --timeout <ms>             Request timeout in ms (default: 15000)
  --help                     Show this help
  --version                  Show version

EXAMPLES
  onpe doctor
  onpe mesa 044739
  onpe mesa 900001 --json
  onpe acta 12345 | jq .detalle
  onpe resumen
  onpe ubigeos 1
  onpe ubigeos 2 150000
`;

function parseArgs(argv: string[]) {
	const args = argv.slice(2);
	const raw: Record<string, unknown> = {};
	const positional: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]!;
		if (arg === "--help" || arg === "-h") {
			raw.help = true;
		} else if (arg === "--version") {
			raw.version = true;
		} else if (arg.startsWith("--")) {
			const key = arg.slice(2);
			const next = args[i + 1];
			if (next && !next.startsWith("--")) {
				raw[key] = next;
				i++;
			} else {
				raw[key] = true;
			}
		} else if (arg === "-q") {
			raw.quiet = true;
		} else {
			positional.push(arg);
		}
	}

	return { raw, positional };
}

function toOnpeError(err: unknown): AppError {
	if (err instanceof OnpeError) {
		if (err.body.includes("HTML fallback")) return mapError({ code: "CDN_BLOCKED" }, ONPE_ERRORS);
		if (err.status === 404) return mapError({ code: "NOT_FOUND" }, ONPE_ERRORS);
		return mapError(err, ONPE_ERRORS);
	}
	if (err instanceof Error && err.name === "AbortError") {
		return mapError({ code: "TIMEOUT" }, ONPE_ERRORS);
	}
	if (err instanceof Error && (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed"))) {
		return mapError({ code: "NETWORK" }, ONPE_ERRORS);
	}
	return mapError(err, ONPE_ERRORS);
}

async function main() {
	const { raw, positional } = parseArgs(process.argv);
	const flags = parseGlobalFlags(raw);

	if (raw.help || positional.length === 0) {
		process.stdout.write(HELP);
		process.exit(0);
	}

	if (raw.version) {
		process.stdout.write("0.1.0\n");
		process.exit(0);
	}

	const timeout = raw.timeout ? Number.parseInt(raw.timeout as string, 10) : undefined;
	const client = new OnpeClient({ timeout });
	const command = positional[0];

	try {
		switch (command) {
			case "doctor": {
				note("Checking ONPE API endpoints...", flags);
				const result = await client.doctor();
				emit(result, flags, () => renderDoctor(result.checks, result.ok));
				emitNextSteps(
					result.ok
						? [
								{ command: "onpe resumen", description: "view election summary" },
								{ command: "onpe mesa 000001", description: "look up a specific mesa" },
							]
						: [{ command: "onpe doctor", description: "retry after fixing connectivity" }],
					flags,
				);
				process.exit(result.ok ? 0 : 1);
				break;
			}

			case "mesa": {
				const codigo = positional[1];
				if (!codigo) {
					reportError("Missing mesa code. Usage: onpe mesa <codigo>", flags);
					process.exit(1);
				}
				const padded = codigo.padStart(6, "0");
				note(`Looking up mesa ${padded}...`, flags);
				const mesas = await client.buscarMesa(padded);
				emit(mesas, flags, () => renderMesa(mesas));
				if (mesas.length > 0) {
					emitNextSteps(
						[
							{ command: `onpe acta ${mesas[0]!.id}`, description: "view full vote breakdown" },
						],
						flags,
					);
				}
				break;
			}

			case "acta": {
				const idStr = positional[1];
				if (!idStr) {
					reportError("Missing acta ID. Usage: onpe acta <id>", flags);
					process.exit(1);
				}
				const id = Number.parseInt(idStr, 10);
				if (Number.isNaN(id)) {
					reportError(`Invalid acta ID: ${idStr}`, flags);
					process.exit(1);
				}
				note(`Fetching acta ${id}...`, flags);
				const acta = await client.actaDetalle(id);
				emit(acta, flags, () => renderActa(acta));
				if (acta.archivos && acta.archivos.length > 0) {
					emitNextSteps(
						acta.archivos.map((a) => ({
							command: `onpe file-url ${a.id}`,
							description: `download ${a.tipo === 1 ? "escrutinio" : "instalacion"} PDF`,
							optional: true,
						})),
						flags,
					);
				}
				break;
			}

			case "resumen": {
				note("Fetching election summary...", flags);
				const { eleccion } = await client.resolveEleccion();
				const resumen = await client.resumenGeneral(eleccion.idEleccion);
				emit(resumen, flags, () => renderResumen(resumen));
				emitNextSteps(
					[
						{ command: "onpe ubigeos 1", description: "list departments" },
						{ command: "onpe mesa <codigo>", description: "look up a specific mesa" },
					],
					flags,
				);
				break;
			}

			case "ubigeos": {
				const nivel = positional[1] ? (Number.parseInt(positional[1], 10) as 1 | 2 | 3) : 1;
				const padre = positional[2];
				note(`Fetching ubigeos nivel ${nivel}${padre ? ` (padre: ${padre})` : ""}...`, flags);
				const { eleccion } = await client.resolveEleccion();
				const ubigeos = await client.ubigeos(eleccion.idEleccion, nivel, padre);
				emit(ubigeos, flags, () => renderUbigeos(ubigeos));
				if (nivel < 3 && ubigeos.length > 0) {
					const nextNivel = nivel + 1;
					emitNextSteps(
						[
							{
								command: `onpe ubigeos ${nextNivel} ${ubigeos[0]!.codigo}`,
								description: `drill down to nivel ${nextNivel}`,
							},
						],
						flags,
					);
				}
				break;
			}

			case "file-url": {
				const fileId = positional[1];
				if (!fileId) {
					reportError("Missing file ID. Usage: onpe file-url <fileId>", flags);
					process.exit(1);
				}
				note(`Resolving file URL for ${fileId}...`, flags);
				const url = await client.actaFileUrl(fileId);
				emit({ url }, flags, () => console.log(url));
				break;
			}

			default:
				reportError(`Unknown command: ${command}`, flags);
				process.stdout.write(HELP);
				process.exit(1);
		}
	} catch (err) {
		const appErr = toOnpeError(err);
		reportError(appErr, flags);
		if (appErr.hint) {
			emitNextSteps([{ command: appErr.hint, description: "suggested fix" }], flags);
		}
		process.exit(1);
	}
}

main();
