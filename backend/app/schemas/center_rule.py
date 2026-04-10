from pydantic import BaseModel, Field, field_validator


class CenterRulesResponse(BaseModel):
    rules: list[str] = Field(default_factory=list)


class CenterRulesUpdate(BaseModel):
    rules: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("rules")
    @classmethod
    def normalize_rules(cls, value: list[str]) -> list[str]:
        normalized_rules: list[str] = []
        for raw_rule in value:
            if not isinstance(raw_rule, str):
                continue
            trimmed_rule = raw_rule.strip()
            if not trimmed_rule:
                continue
            if len(trimmed_rule) < 4:
                raise ValueError("Cada norma debe tener al menos 4 caracteres")
            if len(trimmed_rule) > 400:
                raise ValueError("Cada norma no puede superar 400 caracteres")
            normalized_rules.append(trimmed_rule)
        return normalized_rules
