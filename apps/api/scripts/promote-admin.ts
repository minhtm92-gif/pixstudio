/**
 * Promote a user to systemRole=ADMIN by email.
 *
 * Usage:
 *   bun run apps/api/scripts/promote-admin.ts <email>
 *   bun run apps/api/scripts/promote-admin.ts <email> --role MOD
 *
 * Examples:
 *   bun run apps/api/scripts/promote-admin.ts minhtq@pixelxlab.com
 *   bun run apps/api/scripts/promote-admin.ts tungv@pixelxlab.com --role MOD
 *
 * Required for Phase 1 success-gate measurement (Q57 + Q55):
 *   - anh + minhtq need ADMIN to access /admin/kpi, /admin/stock, /admin/gpu
 *   - Tùng + senior marketers need MOD for bug triage + flagged content review
 */

import { PrismaClient } from "@prisma/client";

async function main() {
	const args = process.argv.slice(2);
	const email = args[0];
	const roleFlag = args.indexOf("--role");
	const role = roleFlag >= 0 ? args[roleFlag + 1] : "ADMIN";

	if (!email || !email.includes("@")) {
		console.error("Usage: bun run apps/api/scripts/promote-admin.ts <email> [--role ADMIN|MOD|USER]");
		process.exit(1);
	}
	if (role !== "ADMIN" && role !== "MOD" && role !== "USER") {
		console.error(`Invalid role: ${role}. Must be ADMIN | MOD | USER.`);
		process.exit(1);
	}

	const prisma = new PrismaClient();
	try {
		const user = await prisma.user.findUnique({
			where: { email: email.toLowerCase() },
			select: { id: true, email: true, name: true, systemRole: true },
		});

		if (!user) {
			console.error(`User ${email} not found. They must sign up first via /signup.`);
			process.exit(1);
		}

		if (user.systemRole === role) {
			console.log(`User ${email} already has systemRole=${role}. No-op.`);
			return;
		}

		const updated = await prisma.user.update({
			where: { id: user.id },
			data: { systemRole: role as "ADMIN" | "MOD" | "USER" },
			select: { id: true, email: true, systemRole: true },
		});

		console.log(`✓ Updated ${updated.email}`);
		console.log(`  ID: ${updated.id}`);
		console.log(`  Role: ${user.systemRole} → ${updated.systemRole}`);
	} catch (err) {
		console.error("Failed:", err);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

void main();
