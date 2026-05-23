import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Terminal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  INFRASTRUCTURE_SECRET_PROVIDERS,
  buildFrontendEnvBlock,
  buildSupabaseSecretsCommand,
  getProviderCompletion,
  type InfrastructureSecretValues,
} from "./infrastructure-secrets";

interface Props {
  onNext: () => void;
}

const OnboardingStepInfrastructure = ({ onNext }: Props) => {
  const [values, setValues] = useState<InfrastructureSecretValues>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  const supabaseCommand = useMemo(() => buildSupabaseSecretsCommand(values), [values]);
  const frontendEnvBlock = useMemo(() => buildFrontendEnvBlock(values), [values]);

  const requiredTotals = useMemo(() => {
    return INFRASTRUCTURE_SECRET_PROVIDERS.reduce(
      (acc, provider) => {
        const completion = getProviderCompletion(provider, values);
        return {
          completed: acc.completed + completion.completedRequired,
          total: acc.total + completion.totalRequired,
        };
      },
      { completed: 0, total: 0 },
    );
  }, [values]);

  const updateValue = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const clearValues = () => {
    setValues({});
    setVisible({});
  };

  return (
    <div className="space-y-6">
      <Card className="glass border-0">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-medium">Infrastructure Secrets</CardTitle>
              <CardDescription>
                Add the keys this self-hosted install needs, then copy the generated commands into your deployment environment.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Secrets are not saved by Prism.</p>
              <p className="text-sm text-muted-foreground">
                Values stay in this browser page only so you can generate setup commands. Copy them into Supabase, Vercel, or your
                self-hosting environment, then clear the form.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Required values entered:{" "}
              <span className="font-medium text-foreground">
                {requiredTotals.completed}/{requiredTotals.total}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={clearValues} className="rounded-full">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear values
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {INFRASTRUCTURE_SECRET_PROVIDERS.map((provider) => {
          const completion = getProviderCompletion(provider, values);

          return (
            <Card key={provider.id} className="glass border-0">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-base font-medium">{provider.name}</CardTitle>
                      <Badge variant={provider.required ? "default" : "secondary"} className="text-[10px]">
                        {provider.required ? "Needed" : "Optional"}
                      </Badge>
                      {completion.complete && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Complete
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{provider.summary}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {provider.consoleUrl && (
                      <Button variant="outline" size="sm" asChild className="rounded-full">
                        <a href={provider.consoleUrl} target="_blank" rel="noreferrer">
                          Open <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" asChild className="rounded-full">
                      <a href={provider.docsUrl} target="_blank" rel="noreferrer">
                        Docs <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/40 p-3">
                  <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                    {provider.instructions.map((instruction) => (
                      <li key={instruction}>{instruction}</li>
                    ))}
                  </ol>
                </div>

                <div className="grid gap-3">
                  {provider.variables.map((variable) => {
                    const isVisible = visible[variable.name] || !variable.sensitive;

                    return (
                      <div key={variable.name} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor={`secret-${variable.name}`} className="text-sm">
                            {variable.label}
                            {variable.required && <span className="text-destructive ml-1">*</span>}
                          </Label>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            {variable.targets.map((target) => (
                              <span key={target} className="rounded-full bg-muted px-2 py-0.5 uppercase tracking-wide">
                                {target === "supabase" ? "Edge" : "Frontend"}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            id={`secret-${variable.name}`}
                            type={isVisible ? "text" : "password"}
                            value={values[variable.name] || ""}
                            onChange={(event) => updateValue(variable.name, event.target.value)}
                            placeholder={variable.placeholder || variable.name}
                            autoComplete="off"
                            spellCheck={false}
                            className="pl-9 pr-10 font-mono text-sm"
                          />
                          {variable.sensitive && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                              onClick={() => setVisible((current) => ({ ...current, [variable.name]: !current[variable.name] }))}
                              title={isVisible ? "Hide value" : "Show value"}
                              aria-label={isVisible ? "Hide value" : "Show value"}
                            >
                              {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{variable.description}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="glass border-0">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Terminal className="h-4 w-4" /> Supabase Edge Function Secrets
            </CardTitle>
            <CardDescription>Run this in your project after `supabase link`.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={supabaseCommand} readOnly className="min-h-[180px] font-mono text-xs resize-none" />
            <Button variant="outline" size="sm" onClick={() => copyText(supabaseCommand, "Supabase command")} className="rounded-full">
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy command
            </Button>
          </CardContent>
        </Card>

        <Card className="glass border-0">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Terminal className="h-4 w-4" /> Frontend / Hosting Env
            </CardTitle>
            <CardDescription>Use this for `.env`, Vercel, Netlify, Docker, or another frontend host.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={frontendEnvBlock} readOnly className="min-h-[180px] font-mono text-xs resize-none" />
            <Button variant="outline" size="sm" onClick={() => copyText(frontendEnvBlock, "Frontend env block")} className="rounded-full">
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy env block
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onNext} className="rounded-full">
          Skip for now
        </Button>
        <Button onClick={onNext} className="bg-gradient-prism text-white rounded-full">
          Continue
        </Button>
      </div>
    </div>
  );
};

export default OnboardingStepInfrastructure;
