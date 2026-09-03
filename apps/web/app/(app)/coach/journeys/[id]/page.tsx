import JourneyEditor from "@/components/JourneyEditor";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditJourneyPage({ params }: Props) {
  const { id } = await params;
  return <JourneyEditor journeyId={id} />;
}
