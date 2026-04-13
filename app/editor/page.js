import EditorClientPage from "./EditorClientPage";

export default async function EditorPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const rawId = resolvedSearchParams?.id;
  const initialDocumentId = typeof rawId === "string" ? rawId : "";

  return <EditorClientPage initialDocumentId={initialDocumentId} />;
}
