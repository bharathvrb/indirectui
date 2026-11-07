package com.orion.quotemanagement.controller;

import com.orion.quotemanagement.entity.Customer;
import com.orion.quotemanagement.entity.CustomerStatus;
import com.orion.quotemanagement.service.CustomerService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * TMF 629 Customer Management REST Controller
 * Base path: /tmf-api/customerManagement/v4
 */
@RestController
@RequestMapping("/tmf-api/customerManagement/v4")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    /**
     * GET /tmf-api/customerManagement/v4/customer
     * List customers with optional filtering and pagination
     */
    @GetMapping("/customer")
    public ResponseEntity<Map<String, Object>> listCustomers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String name) {

        Page<Customer> customerPage;

        if (name != null && !name.isBlank()) {
            customerPage = customerService.searchCustomersByName(name, page, size);
        } else if (status != null && !status.isBlank()) {
            CustomerStatus cs = CustomerStatus.fromValue(status);
            if (cs == null) return ResponseEntity.badRequest().build();
            customerPage = customerService.getCustomersByStatus(cs, page, size);
        } else {
            customerPage = customerService.getAllCustomers(page, size);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("customers", customerPage.getContent());
        response.put("totalElements", customerPage.getTotalElements());
        response.put("totalPages", customerPage.getTotalPages());
        response.put("currentPage", customerPage.getNumber());
        response.put("pageSize", customerPage.getSize());

        return ResponseEntity.ok(response);
    }

    /**
     * GET /tmf-api/customerManagement/v4/customer/{id}
     * Retrieve a specific customer by internal JPA id
     */
    @GetMapping("/customer/{id}")
    public ResponseEntity<Customer> getCustomer(@PathVariable Long id) {
        return customerService.getCustomerById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /tmf-api/customerManagement/v4/customer/ext/{externalId}
     * Retrieve a customer by external / business key
     */
    @GetMapping("/customer/ext/{externalId}")
    public ResponseEntity<Customer> getCustomerByExternalId(@PathVariable String externalId) {
        return customerService.getCustomerByExternalId(externalId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /tmf-api/customerManagement/v4/customer
     * Create a new customer
     */
    @PostMapping("/customer")
    public ResponseEntity<Customer> createCustomer(@Valid @RequestBody Customer customer) {
        Customer created = customerService.createCustomer(customer);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * PATCH /tmf-api/customerManagement/v4/customer/{id}
     * Partial update of a customer
     */
    @PatchMapping("/customer/{id}")
    public ResponseEntity<Customer> patchCustomer(
            @PathVariable Long id,
            @RequestBody Customer patch) {
        return customerService.updateCustomer(id, patch)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
