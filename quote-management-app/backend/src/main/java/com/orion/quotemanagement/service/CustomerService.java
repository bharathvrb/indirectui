package com.orion.quotemanagement.service;

import com.orion.quotemanagement.entity.Customer;
import com.orion.quotemanagement.entity.CustomerStatus;
import com.orion.quotemanagement.repository.CustomerRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * TMF 629 Customer Management service
 */
@Service
@Transactional(readOnly = true)
public class CustomerService {

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    public Page<Customer> getAllCustomers(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("name").ascending());
        return customerRepository.findAll(pageable);
    }

    public Page<Customer> getCustomersByStatus(CustomerStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("name").ascending());
        return customerRepository.findByStatus(status, pageable);
    }

    public Page<Customer> searchCustomersByName(String name, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("name").ascending());
        return customerRepository.findByNameContainingIgnoreCase(name, pageable);
    }

    public Optional<Customer> getCustomerById(Long id) {
        return customerRepository.findById(id);
    }

    public Optional<Customer> getCustomerByExternalId(String externalId) {
        return customerRepository.findByExternalId(externalId);
    }

    @Transactional
    public Customer createCustomer(Customer customer) {
        return customerRepository.save(customer);
    }

    @Transactional
    public Optional<Customer> updateCustomer(Long id, Customer patch) {
        return customerRepository.findById(id).map(existing -> {
            if (patch.getName() != null) existing.setName(patch.getName());
            if (patch.getTradingName() != null) existing.setTradingName(patch.getTradingName());
            if (patch.getStatus() != null) existing.setStatus(patch.getStatus());
            if (patch.getStatusReason() != null) existing.setStatusReason(patch.getStatusReason());
            if (patch.getSegment() != null) existing.setSegment(patch.getSegment());
            if (patch.getCreditTier() != null) existing.setCreditTier(patch.getCreditTier());
            if (patch.getAccountRef() != null) existing.setAccountRef(patch.getAccountRef());
            return customerRepository.save(existing);
        });
    }

    public List<Customer> getAllCustomersList() {
        return customerRepository.findAll(Sort.by("name").ascending());
    }
}
