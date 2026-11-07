package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;

/**
 * TMF 632 Party Management API - ContactMedium entity
 * Represents a means of contacting a party (phone, email, address, etc.)
 * Spec: TMF632 Party Management v5.0
 */
@Entity
@Table(name = "contact_mediums", indexes = {
    @Index(name = "idx_contact_medium_customer_id", columnList = "customer_id"),
    @Index(name = "idx_contact_medium_type", columnList = "mediumType")
})
public class ContactMedium {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Type of contact medium (email, phone, mobile, fax, postalAddress, socialNetwork)
     * TMF 632: mediumType
     */
    @Column(name = "mediumType", nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    @NotNull(message = "Contact medium type is required")
    @JsonProperty("mediumType")
    private ContactMediumType mediumType;

    /**
     * Whether this is the preferred contact medium for the party
     * TMF 632: preferred
     */
    @Column(name = "preferred")
    @JsonProperty("preferred")
    private Boolean preferred = false;

    /**
     * Contact type label (e.g. "work", "home", "billing")
     * TMF 632: ContactMediumCharacteristic.contactType
     */
    @Column(name = "contact_type", length = 50)
    @JsonProperty("contactType")
    private String contactType;

    /**
     * Email address
     * TMF 632: ContactMediumCharacteristic.emailAddress
     */
    @Column(name = "email_address", length = 255)
    @Email(message = "Invalid email address format")
    @JsonProperty("emailAddress")
    private String emailAddress;

    /**
     * Phone number
     * TMF 632: ContactMediumCharacteristic.phoneNumber
     */
    @Column(name = "phone_number", length = 50)
    @JsonProperty("phoneNumber")
    private String phoneNumber;

    /**
     * Social network identifier (handle)
     * TMF 632: ContactMediumCharacteristic.socialNetworkId
     */
    @Column(name = "social_network_id", length = 255)
    @JsonProperty("socialNetworkId")
    private String socialNetworkId;

    /**
     * Street line 1 (postal address)
     * TMF 632: ContactMediumCharacteristic.street1
     */
    @Column(name = "street1", length = 255)
    @JsonProperty("street1")
    private String street1;

    /**
     * Street line 2 (postal address)
     * TMF 632: ContactMediumCharacteristic.street2
     */
    @Column(name = "street2", length = 255)
    @JsonProperty("street2")
    private String street2;

    /**
     * City (postal address)
     * TMF 632: ContactMediumCharacteristic.city
     */
    @Column(name = "city", length = 100)
    @JsonProperty("city")
    private String city;

    /**
     * State or province (postal address)
     * TMF 632: ContactMediumCharacteristic.stateOrProvince
     */
    @Column(name = "state_or_province", length = 100)
    @JsonProperty("stateOrProvince")
    private String stateOrProvince;

    /**
     * Post code / ZIP (postal address)
     * TMF 632: ContactMediumCharacteristic.postCode
     */
    @Column(name = "post_code", length = 20)
    @JsonProperty("postCode")
    private String postCode;

    /**
     * Country (postal address)
     * TMF 632: ContactMediumCharacteristic.country
     */
    @Column(name = "country", length = 100)
    @JsonProperty("country")
    private String country;

    /**
     * Parent customer (back-reference, excluded from serialisation)
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @JsonIgnore
    private Customer customer;

    // Constructors
    public ContactMedium() {}

    public ContactMedium(ContactMediumType mediumType, String contactType, Boolean preferred) {
        this.mediumType = mediumType;
        this.contactType = contactType;
        this.preferred = preferred;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public ContactMediumType getMediumType() { return mediumType; }
    public void setMediumType(ContactMediumType mediumType) { this.mediumType = mediumType; }

    public Boolean getPreferred() { return preferred; }
    public void setPreferred(Boolean preferred) { this.preferred = preferred; }

    public String getContactType() { return contactType; }
    public void setContactType(String contactType) { this.contactType = contactType; }

    public String getEmailAddress() { return emailAddress; }
    public void setEmailAddress(String emailAddress) { this.emailAddress = emailAddress; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getSocialNetworkId() { return socialNetworkId; }
    public void setSocialNetworkId(String socialNetworkId) { this.socialNetworkId = socialNetworkId; }

    public String getStreet1() { return street1; }
    public void setStreet1(String street1) { this.street1 = street1; }

    public String getStreet2() { return street2; }
    public void setStreet2(String street2) { this.street2 = street2; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getStateOrProvince() { return stateOrProvince; }
    public void setStateOrProvince(String stateOrProvince) { this.stateOrProvince = stateOrProvince; }

    public String getPostCode() { return postCode; }
    public void setPostCode(String postCode) { this.postCode = postCode; }

    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }

    public Customer getCustomer() { return customer; }
    public void setCustomer(Customer customer) { this.customer = customer; }
}
