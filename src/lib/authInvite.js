/** A app só aceita utilizadores convidados: uma recusa do registo quer dizer, na prática, que o email não tem convite. */
export function isNotInvitedError(err) {
  const status = err?.status ?? err?.response?.status;
  const text = `${err?.message || ""} ${err?.data?.message || ""} ${err?.data?.extra_data?.reason || ""}`;
  return status === 401 || status === 403 || /invit|private|not registered|auth_required/i.test(text);
}
