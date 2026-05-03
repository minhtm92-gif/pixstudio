/**
 * /editor index — redirects to /projects.
 *
 * The actual editor lives at /editor/[project_id]. Top-level /editor with no
 * project context just sends the user to project picker.
 */

import { redirect } from "next/navigation";

export default function EditorIndexPage() {
	redirect("/projects");
}
