package com.vts.config;

import org.springframework.boot.web.servlet.MultipartConfigFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.unit.DataSize;

@Configuration
public class WebConfig {

    @Bean
    public MultipartConfigFactory customMultipartConfig() {
        MultipartConfigFactory factory = new MultipartConfigFactory();

        // Set max file size to 50MB
        factory.setMaxFileSize(DataSize.ofMegabytes(50));

        // Set max request size to 50MB
        factory.setMaxRequestSize(DataSize.ofMegabytes(50));

        return factory;
    }
}
