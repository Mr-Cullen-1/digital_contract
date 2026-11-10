import { ContractEditor } from "@/components/contract-editor";
import { owner, readContract, withUrls } from "@/lib/contracts";
import { notFound, redirect } from "next/navigation";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let c;
  try {
    const user = await owner();
    c = await withUrls(await readContract(id, user.id));
  } catch {
    notFound();
  }
  if (c.status !== "Draft") redirect(`/contracts/${id}`);
  return <ContractEditor initial={c} configured />;
}
