package com.bank.yaksok;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;


@EnableScheduling
@SpringBootApplication
public class YakSokApplication {

    public static void main(String[] args) {
        SpringApplication.run(YakSokApplication.class, args);
    }

}
