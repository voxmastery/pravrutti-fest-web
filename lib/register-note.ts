/**
 * The sentence under Request to join.
 *
 * `{phone}` is filled from the coordinators route, the same lookup the call
 * button uses. The digits never live on the event in pravrutti-data.ts —
 * that file is the public events array, and coordinator mobiles are kept
 * out of it. When the number has not arrived yet the sentence is omitted,
 * so the page never shows the placeholder.
 */
export function registerNoteText(
  note: string | undefined,
  coordinator: string | undefined,
  phones: Record<string, string>,
): string | null {
  if (!note) return null;
  if (!note.includes("{phone}")) return note;
  const phone = coordinator ? phones[coordinator] : undefined;
  if (!phone) return null;
  return note.replaceAll("{phone}", phone);
}
