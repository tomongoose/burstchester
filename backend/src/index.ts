import { buildDefaultHandlerDeps } from "./handlers/deps";
import { createHealthCheck, handleHealthCheck } from "./handlers/health-check";
import { createOnUserCreate } from "./handlers/user-create";
import { createOnDatasetUpload } from "./handlers/dataset-upload";
import { createOnLikeWrite } from "./handlers/like-write";
import { createOnReportWrite } from "./handlers/report-write";
import { createPrepareDownload } from "./handlers/prepare-download";
import { createPrepareDatasetDownload } from "./handlers/prepare-dataset-download";
import { createRegisterModel } from "./handlers/register-model";
import { createCliGoogleAuth } from "./handlers/cli-google-auth";
import { createDebugUploadDataset } from "./handlers/debug-upload-dataset";
import { createUpsertCliProfile } from "./handlers/upsert-cli-profile";

const deps = buildDefaultHandlerDeps();

export { handleHealthCheck as healthCheckHandler };
export const healthCheck = createHealthCheck();
export const onUserCreate = createOnUserCreate(deps);
export const onDatasetUpload = createOnDatasetUpload(deps);
export const onLikeWrite = createOnLikeWrite(deps);
export const onReportWrite = createOnReportWrite(deps);
export const prepareDownload = createPrepareDownload(deps);
export const prepareDatasetDownload = createPrepareDatasetDownload(deps);
export const registerModel = createRegisterModel(deps);
export const cliGoogleAuth = createCliGoogleAuth(deps);
export const debugUploadDataset = createDebugUploadDataset(deps);
export const upsertCliProfile = createUpsertCliProfile(deps);
