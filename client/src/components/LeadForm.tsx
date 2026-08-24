import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LeadStageSelect from "@/components/LeadStageSelect";
import type { CreateLeadRequest } from "@shared/schema";
import type { LeadStage } from "@shared/leadStages";

interface FormValues {
  name: string;
  company: string;
  location: string;
  instagramUrl: string;
  stage: LeadStage;
  source: string;
  fitnessGoal: string;
}

export default function LeadForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (input: CreateLeadRequest) => void;
  isSubmitting?: boolean;
}) {
  const form = useForm<FormValues>({
    defaultValues: { name: "", company: "", location: "", instagramUrl: "", stage: "new", source: "", fitnessGoal: "" },
  });

  const handleSubmit = (values: FormValues) => {
    if (!values.name.trim()) return;
    onSubmit({
      person: {
        name: values.name.trim(),
        company: values.company.trim() || null,
        location: values.location.trim() || null,
        instagramUrl: values.instagramUrl.trim() || null,
      },
      stage: values.stage,
      source: values.source.trim() || null,
      fitnessGoal: values.fitnessGoal.trim() || null,
    } as CreateLeadRequest);
    form.reset();
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="lead-name">Name</Label>
          <Input id="lead-name" {...form.register("name", { required: true })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-stage">Stage</Label>
          <LeadStageSelect value={form.watch("stage")} onChange={(stage) => form.setValue("stage", stage)} className="w-full" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-source">Source</Label>
          <Input id="lead-source" placeholder="Instagram DM, referral..." {...form.register("source")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-company">Company</Label>
          <Input id="lead-company" {...form.register("company")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-location">Location</Label>
          <Input id="lead-location" {...form.register("location")} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="lead-instagram">Instagram profile</Label>
          <Input id="lead-instagram" placeholder="https://instagram.com/..." {...form.register("instagramUrl")} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="lead-fitness-goal">Fitness goal</Label>
          <Textarea id="lead-fitness-goal" placeholder="What are they hoping to achieve?" {...form.register("fitnessGoal")} />
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Adding..." : "Add lead"}
      </Button>
    </form>
  );
}
