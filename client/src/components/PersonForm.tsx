import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PersonAvatar from "@/components/PersonAvatar";
import { fileToResizedDataUrl } from "@/lib/image";
import { useToast } from "@/hooks/use-toast";
import { RELATIONSHIP_TIERS, RELATIONSHIP_TIER_LABELS, type RelationshipTier } from "@shared/relationshipTiers";
import type { InsertPerson, Person } from "@shared/schema";

interface FormValues {
  name: string;
  howMet: string;
  company: string;
  role: string;
  location: string;
  tagsInput: string;
  birthday: string;
  photoUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  relationshipTier: RelationshipTier;
}

function toFormValues(person?: Person): FormValues {
  return {
    name: person?.name ?? "",
    howMet: person?.howMet ?? "",
    company: person?.company ?? "",
    role: person?.role ?? "",
    location: person?.location ?? "",
    tagsInput: person?.tags?.join(", ") ?? "",
    birthday: person?.birthday ?? "",
    photoUrl: person?.photoUrl ?? "",
    facebookUrl: person?.facebookUrl ?? "",
    instagramUrl: person?.instagramUrl ?? "",
    linkedinUrl: person?.linkedinUrl ?? "",
    relationshipTier: person?.relationshipTier ?? "acquaintance",
  };
}

export default function PersonForm({
  person,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
}: {
  person?: Person;
  onSubmit: (input: InsertPerson) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}) {
  const form = useForm<FormValues>({ defaultValues: toFormValues(person) });
  const { toast } = useToast();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      form.setValue("photoUrl", await fileToResizedDataUrl(file));
    } catch {
      toast({ variant: "destructive", title: "Couldn't load that image" });
    }
  };

  const handleSubmit = (values: FormValues) => {
    onSubmit({
      name: values.name.trim(),
      howMet: values.howMet.trim() || null,
      company: values.company.trim() || null,
      role: values.role.trim() || null,
      location: values.location.trim() || null,
      tags: values.tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      birthday: values.birthday.trim() || null,
      photoUrl: values.photoUrl || null,
      facebookUrl: values.facebookUrl.trim() || null,
      instagramUrl: values.instagramUrl.trim() || null,
      linkedinUrl: values.linkedinUrl.trim() || null,
      relationshipTier: values.relationshipTier,
    } as InsertPerson);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="flex items-center gap-4">
        <PersonAvatar name={form.watch("name") || "?"} photoUrl={form.watch("photoUrl")} className="h-16 w-16 text-lg" />
        <div className="space-y-1.5">
          <Label htmlFor="photo">Profile photo</Label>
          <div className="flex items-center gap-2">
            <Input id="photo" type="file" accept="image/*" onChange={handlePhotoChange} className="max-w-xs" />
            {form.watch("photoUrl") && (
              <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("photoUrl", "")}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...form.register("name", { required: true })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="relationshipTier">Relationship tier</Label>
          <Select
            value={form.watch("relationshipTier")}
            onValueChange={(value) => form.setValue("relationshipTier", value as RelationshipTier)}
          >
            <SelectTrigger id="relationshipTier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_TIERS.map((tier) => (
                <SelectItem key={tier} value={tier}>
                  {RELATIONSHIP_TIER_LABELS[tier]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="birthday">Birthday (MM-DD)</Label>
          <Input id="birthday" placeholder="03-14" {...form.register("birthday")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="howMet">How we met</Label>
          <Input id="howMet" {...form.register("howMet")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" {...form.register("location")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Role</Label>
          <Input id="role" {...form.register("role")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Company</Label>
          <Input id="company" {...form.register("company")} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="tagsInput">Tags (comma separated)</Label>
          <Input id="tagsInput" placeholder="climbing, ex-coworker" {...form.register("tagsInput")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="facebookUrl">Facebook profile</Label>
          <Input id="facebookUrl" placeholder="https://facebook.com/..." {...form.register("facebookUrl")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="instagramUrl">Instagram profile</Label>
          <Input id="instagramUrl" placeholder="https://instagram.com/..." {...form.register("instagramUrl")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="linkedinUrl">LinkedIn profile</Label>
          <Input id="linkedinUrl" placeholder="https://linkedin.com/in/..." {...form.register("linkedinUrl")} />
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
