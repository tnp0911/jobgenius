"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import "./register.css";
import { handleRegister } from "@/auth/api";
import { RegisterRequest } from "@/auth/types";
import { isAborted } from "@/utils/errorHelpers";

export function RegisterForm() {
  const router = useRouter();
  const controllerRef = useRef<AbortController | null>(null);

  const [lastname, setLastname] = useState("");
  const [firstname, setFirstname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // abort previous request if user clicks multiple times
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const name: string = `${lastname} ${firstname}`;

      const registerRequest: RegisterRequest = {
        name,
        email,
        password,
      };
      await handleRegister(registerRequest, { signal: controller.signal });
      if (controllerRef.current !== controller) return;
      router.replace("/login");
      toast.success("Registration successful");
    } catch (error: unknown) {
      if (isAborted(error)) return;
      if (axios.isAxiosError(error)) {
        toast.error(
          "Registration failed: " +
            (error.response?.data?.message || error.message),
        );
      } else if (error instanceof Error) {
        toast.error("Registration failed: " + error.message);
      } else {
        toast.error("Registration failed. Please try again later.");
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  };

  return (
    <div className="wrapper">
      <h2>Welcome to JobGenius</h2>
      <form
        onSubmit={handleSubmit}
        className="register-form"
        autoComplete="off"
      >
        <div className="name-row">
          <div className="input-field">
            <input
              id="lastname"
              type="text"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              placeholder=" "
              autoComplete="off"
              required
            />
            <label htmlFor="lastname">Last Name</label>
          </div>
          <div className="input-field">
            <input
              id="firstname"
              type="text"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              placeholder=" "
              autoComplete="off"
              required
            />
            <label htmlFor="firstname">First Name</label>
          </div>
        </div>
        <div className="input-field">
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder=" "
            autoComplete="off"
            required
          />
          <label htmlFor="email">Email</label>
        </div>
        <div className="input-field">
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder=" "
            autoComplete="new-password"
            required
          />
          <label htmlFor="password">Password</label>
        </div>
        <div className="input-field">
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder=" "
            autoComplete="new-password"
            required
          />
          <label htmlFor="confirmPassword">Confirm Password</label>
        </div>
        <button type="submit">Register</button>
      </form>
      <div className="register-form-bottom">
        <p className="login-link">
          Already have an account? <Link href="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
