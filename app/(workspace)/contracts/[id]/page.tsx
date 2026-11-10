import { ContractDetails } from "@/components/contract-details";
import { owner, readContract, withUrls } from "@/lib/contracts";
import { notFound } from "next/navigation";
export default async function Details({
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
  return <ContractDetails initial={c} />;
}
