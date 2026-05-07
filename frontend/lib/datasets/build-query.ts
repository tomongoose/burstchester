import {
  collection,
  limit,
  orderBy,
  query,
  where,
  type Firestore,
  type Query,
  type QueryConstraint,
} from "firebase/firestore";
import { SearchFilter } from "@/lib/domain/search-filter";

export type SortOrder = "popular" | "newest";
const DEFAULT_LIMIT = 24;

export interface BuildDatasetQueryOptions {
  readonly sort: SortOrder;
  readonly db: Firestore;
  readonly resultLimit?: number;
}

export function buildDatasetQuery(
  filter: SearchFilter,
  options: BuildDatasetQueryOptions,
): Query {
  const constraints: QueryConstraint[] = [where("status", "==", "active")];

  if (filter.language) {
    constraints.push(where("language", "==", filter.language));
  }
  if (filter.task) {
    constraints.push(where("taskType", "==", filter.task));
  }
  if (filter.baseModel) {
    constraints.push(where("baseModelHint", "==", filter.baseModel));
  }
  if (filter.tags.length > 0) {
    constraints.push(where("tags", "array-contains-any", [...filter.tags]));
  }

  const orderField = options.sort === "newest" ? "createdAt" : "downloadCount";
  constraints.push(orderBy(orderField, "desc"));
  constraints.push(limit(options.resultLimit ?? DEFAULT_LIMIT));

  return query(collection(options.db, "datasets"), ...constraints);
}
