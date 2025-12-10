package com.ktb.chatapp.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class NameValidator implements ConstraintValidator<ValidName, String> {

    private int minLength;

    @Override
    public void initialize(ValidName constraintAnnotation) {
        this.minLength = constraintAnnotation.min();
    }

    @Override
    public boolean isValid(String name, ConstraintValidatorContext context) {
        if (name == null || name.trim().isEmpty()) {
            return false;
        }
        return name.trim().length() >= minLength;
    }
}
