package com.ktb.chatapp.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = NameValidator.class)
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidName {
    String message() default "이름은 2자 이상이어야 합니다.";
    int min() default 2;
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
