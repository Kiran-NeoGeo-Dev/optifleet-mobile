package com.vts.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class Base64SizeValidatorImpl implements ConstraintValidator<Base64SizeValidator, String> {

    private long maxSizeInBytes;

    @Override
    public void initialize(Base64SizeValidator constraintAnnotation) {
        this.maxSizeInBytes = constraintAnnotation.maxSizeInBytes();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isEmpty()) {
            return true; // Null or empty values are allowed
        }

        try {
            // Calculate the actual size of the decoded image
            // Base64 encoding increases size by approximately 33%
            // So we divide by 1.33 to get the original size
            long base64Length = value.length();
            long originalSize = (long) (base64Length / 1.33);

            return originalSize <= maxSizeInBytes;
        } catch (Exception e) {
            return false;
        }
    }
}
