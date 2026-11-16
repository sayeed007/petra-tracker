"use client";

import { useState, useTransition } from "react";
import { App, Input, Modal } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { decideRequestInline } from "@/app/[locale]/(protected)/issues/actions";

type Props = {
  id: string;
  title: string;
  /** Status labels, already translated. */
  from: string;
  to: string;
  by: string | null;
  reason: string | null;
};

/**
 * Approve / Reject buttons for a waiting status request, right in the list row.
 * Each opens a small popup with the developer's reason and a note (required to reject), and saves without leaving the list.
 */
export function ReviewRequest({ id, title, from, to, by, reason }: Readonly<Props>) {
  const t = useTranslations("issue");
  const d = useTranslations("dashboard");
  const locale = useLocale();
  const router = useRouter();
  const { message } = App.useApp();
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [missingReason, setMissingReason] = useState(false);
  const [saving, startSaving] = useTransition();

  const open = (next: "approve" | "reject") => {
    setDecision(next);
    setNote("");
    setMissingReason(false);
  };

  function submit() {
    if (!decision) return;
    if (decision === "reject" && !note.trim()) {
      setMissingReason(true);
      return;
    }
    const body = new FormData();
    body.set("decision", decision);
    body.set("note", note.trim());
    startSaving(async () => {
      const { result } = await decideRequestInline(locale, id, body);
      if (result === "approved" || result === "rejected") {
        message.success(result === "approved" ? t("decidedApproved") : t("decidedRejected"), 4);
        setDecision(null);
        router.refresh();
      } else if (result === "rejectReason") setMissingReason(true);
      else {
        message.error(result === "conflict" || result === "missing" ? t("conflict") : t("invalid"), 5);
        setDecision(null);
        router.refresh();
      }
    });
  }

  const rejecting = decision === "reject";
  return (
    <>
      <span className="review-actions">
        <button type="button" className="button button-sm button-ok" onClick={() => open("approve")} title={t("approve")}>✓ {t("approve")}</button>
        <button type="button" className="button button-sm button-danger" onClick={() => open("reject")} title={t("reject")}>✕ {t("reject")}</button>
      </span>
      <Modal
        open={decision !== null}
        title={rejecting ? d("reviewRejectTitle") : d("reviewApproveTitle")}
        okText={rejecting ? t("reject") : t("approve")}
        okButtonProps={{ danger: rejecting, loading: saving }}
        cancelButtonProps={{ disabled: saving }}
        onOk={submit}
        onCancel={() => !saving && setDecision(null)}
        destroyOnHidden
        maskClosable={!saving}
      >
        <p className="review-issue"><strong>{title}</strong> <span className="issue-id">{id}</span></p>
        <p>{d("reviewAsked", { name: by ?? "—", from, to })}</p>
        <div className="review-reason">
          <span className="muted">{d("reviewReason")}</span>
          <p>{reason || d("reviewNoReason")}</p>
        </div>
        <label className="review-note-label" htmlFor={`review-note-${id}`}>{rejecting ? d("reviewRejectNote") : d("reviewApproveNote")}</label>
        <Input.TextArea
          id={`review-note-${id}`}
          autoFocus
          value={note}
          maxLength={4000}
          autoSize={{ minRows: 3, maxRows: 8 }}
          status={missingReason ? "error" : undefined}
          placeholder={t("decisionNotePlaceholder")}
          onChange={(event) => {
            setNote(event.target.value);
            if (event.target.value.trim()) setMissingReason(false);
          }}
          onKeyDown={(event) => {
            // Ctrl/Cmd+Enter saves, so a quick approval is two keystrokes
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit();
          }}
        />
        {missingReason && <p className="field-error">{t("rejectReasonNeeded")}</p>}
      </Modal>
    </>
  );
}
