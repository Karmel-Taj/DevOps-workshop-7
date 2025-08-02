# Docker Container Monitoring Project

## Screencast
[Watch the Screencast](https://drive.google.com/file/d/10URYpAy6jGhw_yOxfzPatgwFsrsOsL4p/view?usp=sharing)

## Overview

This project runs 3 Docker containers locally, each with an agent. A monitoring dashboard on local tracks CPU, memory, latency, HTTP, and health of these containers.

## Results & Monitoring Benefits

The dashboard helped us spot issues like high CPU or memory use, delays in HTTP responses, and container restarts. This early detection allows quick fixes before users are affected.

## Blue-Green Deployment & Failover

In blue-green deployment, deciding when to switch depends on reliable metrics. Monitoring multiple signs together (CPU, latency, health) helps make better failover decisions. However, under chaos, scores may not be perfect, so thresholds and backup plans are needed.

