import { onDocumentWritten } from "firebase-functions/v2/firestore";
import type { DatasetRecord } from "../core/datasets";
import { applyReportWrite } from "../core/engagement";
import type { HandlerDeps } from "./deps";

export function createOnReportWrite(deps: Pick<HandlerDeps, "db" | "fieldValue">) {
  return onDocumentWritten(
    { region: "us-central1", document: "datasets/{id}/reports/{uid}" },
    async (event) => {
      const beforeExists = event.data?.before.exists ?? false;
      const afterExists = event.data?.after.exists ?? false;
      if (beforeExists === afterExists) {
        return;
      }

      const datasetRef = deps.db.doc(`datasets/${event.params.id}`);
      await deps.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(datasetRef);
        if (!snapshot.exists) {
          return;
        }

        const dataset = snapshot.data() as DatasetRecord;
        const result = applyReportWrite(dataset, beforeExists, afterExists);

        transaction.update(datasetRef, {
          reportCount: result.dataset.reportCount,
          status: result.dataset.status,
          updatedAt: deps.fieldValue.serverTimestamp(),
        });
        transaction.set(
          deps.db.doc(`users/${result.owner.uid}`),
          {
            reputation: deps.fieldValue.increment(result.owner.reputationDelta),
          },
          { merge: true },
        );
      });
    },
  );
}
