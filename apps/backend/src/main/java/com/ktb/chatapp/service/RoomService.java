package com.ktb.chatapp.service;

import com.ktb.chatapp.dto.CreateRoomRequest;
import com.ktb.chatapp.dto.HealthResponse;
import com.ktb.chatapp.dto.PageMetadata;
import com.ktb.chatapp.dto.RoomResponse;
import com.ktb.chatapp.dto.RoomsResponse;
import com.ktb.chatapp.dto.UserResponse;
import com.ktb.chatapp.event.RoomCreatedEvent;
import com.ktb.chatapp.event.RoomUpdatedEvent;
import com.ktb.chatapp.model.Room;
import com.ktb.chatapp.model.User;
import com.ktb.chatapp.repository.MessageRepository;
import com.ktb.chatapp.repository.RoomRepository;
import com.ktb.chatapp.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.Set;


@Slf4j
@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationEventPublisher eventPublisher;

    public RoomsResponse getAllRoomsWithPagination(
            com.ktb.chatapp.dto.PageRequest pageRequest, String name) {

        try {
            // 정렬 설정 검증
            if (!pageRequest.isValidSortField()) {
                pageRequest.setSortField("createdAt");
            }
            if (!pageRequest.isValidSortOrder()) {
                pageRequest.setSortOrder("desc");
            }

            // 정렬 방향 설정
            Sort.Direction direction = "desc".equals(pageRequest.getSortOrder())
                    ? Sort.Direction.DESC
                    : Sort.Direction.ASC;

            // 정렬 필드 매핑 (participantsCount는 특별 처리 필요)
            String sortField = pageRequest.getSortField();
            if ("participantsCount".equals(sortField)) {
                sortField = "participantIds"; // MongoDB 필드명으로 변경
            }

            // Pageable 객체 생성
            PageRequest springPageRequest = PageRequest.of(
                    pageRequest.getPage(),
                    pageRequest.getPageSize(),
                    Sort.by(direction, sortField)
            );

            // 검색어가 있는 경우와 없는 경우 분리
            Page<Room> roomPage;
            if (pageRequest.getSearch() != null && !pageRequest.getSearch().trim().isEmpty()) {
                roomPage = roomRepository.findByNameContainingIgnoreCase(
                        pageRequest.getSearch().trim(), springPageRequest);
            } else {
                roomPage = roomRepository.findAll(springPageRequest);
            }

            // 페이지에서 Room 리스트 꺼내기
            List<Room> rooms = roomPage.getContent();

            // 방이 아예 없으면 바로 빈 응답 반환
            if (rooms.isEmpty()) {
                PageMetadata emptyMetadata = PageMetadata.builder()
                        .total(roomPage.getTotalElements())
                        .page(pageRequest.getPage())
                        .pageSize(pageRequest.getPageSize())
                        .totalPages(roomPage.getTotalPages())
                        .hasMore(roomPage.hasNext())
                        .currentCount(0)
                        .sort(PageMetadata.SortInfo.builder()
                                .field(pageRequest.getSortField())
                                .order(pageRequest.getSortOrder())
                                .build())
                        .build();

                return RoomsResponse.builder()
                        .success(true)
                        .data(List.of())
                        .metadata(emptyMetadata)
                        .build();
            }

            // 1) 모든 방에서 필요한 유저 ID 모으기
            Set<String> userIds = new java.util.HashSet<>();
            for (Room room : rooms) {
                if (room.getCreator() != null) {
                    userIds.add(room.getCreator());
                }
                if (room.getParticipantIds() != null) {
                    userIds.addAll(room.getParticipantIds());
                }
            }

            // 2) 한 번에 유저들 조회 (N+1 방지)
            List<User> users = userRepository.findByIdIn(userIds);

            // 3) id -> User 맵으로 변환
            Map<String, User> userMap = users.stream()
                    .collect(Collectors.toMap(User::getId, u -> u));

            // 4) Room -> RoomResponse 변환 (쿼리 없이 userMap 사용)
            List<RoomResponse> roomResponses = rooms.stream()
                    .map(room -> mapToRoomResponseOptimized(room, name, userMap))
                    .toList();

            // 메타데이터 생성
            PageMetadata metadata = PageMetadata.builder()
                    .total(roomPage.getTotalElements())
                    .page(pageRequest.getPage())
                    .pageSize(pageRequest.getPageSize())
                    .totalPages(roomPage.getTotalPages())
                    .hasMore(roomPage.hasNext())
                    .currentCount(roomResponses.size())
                    .sort(PageMetadata.SortInfo.builder()
                            .field(pageRequest.getSortField())
                            .order(pageRequest.getSortOrder())
                            .build())
                    .build();

            return RoomsResponse.builder()
                    .success(true)
                    .data(roomResponses)
                    .metadata(metadata)
                    .build();

        } catch (Exception e) {
            log.error("방 목록 조회 에러", e);
            return RoomsResponse.builder()
                    .success(false)
                    .data(List.of())
                    .build();
        }
    }

    private RoomResponse mapToRoomResponseOptimized(Room room, String currentUserEmail, Map<String, User> userMap) {
        if (room == null) return null;

        User creator = null;
        if (room.getCreator() != null) {
            creator = userMap.get(room.getCreator());
        }

        List<UserResponse> participantResponses = room.getParticipantIds().stream()
                .map(userMap::get)
                .filter(java.util.Objects::nonNull)
                .map(p -> UserResponse.builder()
                        .id(p.getId())
                        .name(p.getName() != null ? p.getName() : "알 수 없음")
                        .email(p.getEmail() != null ? p.getEmail() : "")
                        .build())
                .toList();

        LocalDateTime tenMinutesAgo = LocalDateTime.now().minusMinutes(10);
        long recentMessageCount = messageRepository.countRecentMessagesByRoomId(room.getId(), tenMinutesAgo);

        return RoomResponse.builder()
                .id(room.getId())
                .name(room.getName() != null ? room.getName() : "제목 없음")
                .hasPassword(room.isHasPassword())
                .creator(creator != null ? UserResponse.builder()
                        .id(creator.getId())
                        .name(creator.getName() != null ? creator.getName() : "알 수 없음")
                        .email(creator.getEmail() != null ? creator.getEmail() : "")
                        .build() : null)
                .participants(participantResponses)
                .createdAtDateTime(room.getCreatedAt())
                .isCreator(creator != null && creator.getEmail() != null && creator.getEmail().equals(currentUserEmail))
                .recentMessageCount((int) recentMessageCount)
                .build();
    }


    public HealthResponse getHealthStatus() {
        try {
            long startTime = System.currentTimeMillis();

            // MongoDB 연결 상태 확인
            boolean isMongoConnected = false;
            long latency = 0;

            try {
                // 간단한 쿼리로 연결 상태 및 지연 시간 측정
                roomRepository.findOneForHealthCheck();
                long endTime = System.currentTimeMillis();
                latency = endTime - startTime;
                isMongoConnected = true;
            } catch (Exception e) {
                log.warn("MongoDB 연결 확인 실패", e);
                isMongoConnected = false;
            }

            // 최근 활동 조회
            LocalDateTime lastActivity = roomRepository.findMostRecentRoom()
                    .map(Room::getCreatedAt)
                    .orElse(null);

            // 서비스 상태 정보 구성
            Map<String, HealthResponse.ServiceHealth> services = new HashMap<>();
            services.put("database", HealthResponse.ServiceHealth.builder()
                .connected(isMongoConnected)
                .latency(latency)
                .build());

            return HealthResponse.builder()
                .success(true)
                .services(services)
                .lastActivity(lastActivity)
                .build();

        } catch (Exception e) {
            log.error("Health check 실행 중 에러 발생", e);
            return HealthResponse.builder()
                .success(false)
                .services(new HashMap<>())
                .build();
        }
    }

    public Room createRoom(CreateRoomRequest createRoomRequest, String name) {
        User creator = userRepository.findByEmail(name)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다: " + name));

        Room room = new Room();
        room.setName(createRoomRequest.getName().trim());
        room.setCreator(creator.getId());
        room.getParticipantIds().add(creator.getId());

        if (createRoomRequest.getPassword() != null && !createRoomRequest.getPassword().isEmpty()) {
            room.setHasPassword(true);
            room.setPassword(passwordEncoder.encode(createRoomRequest.getPassword()));
        }

        Room savedRoom = roomRepository.save(room);
        
        // Publish event for room created
        try {
            RoomResponse roomResponse = mapToRoomResponse(savedRoom, name);
            eventPublisher.publishEvent(new RoomCreatedEvent(this, roomResponse));
        } catch (Exception e) {
            log.error("roomCreated 이벤트 발행 실패", e);
        }
        
        return savedRoom;
    }

    public Optional<Room> findRoomById(String roomId) {
        return roomRepository.findById(roomId);
    }

    public Room joinRoom(String roomId, String password, String name) {
        Optional<Room> roomOpt = roomRepository.findById(roomId);
        if (roomOpt.isEmpty()) {
            return null;
        }

        Room room = roomOpt.get();
        User user = userRepository.findByEmail(name)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다: " + name));

        // 비밀번호 확인
        if (room.isHasPassword()) {
            if (password == null || !passwordEncoder.matches(password, room.getPassword())) {
                throw new RuntimeException("비밀번호가 일치하지 않습니다.");
            }
        }

        // 이미 참여중인지 확인
        if (!room.getParticipantIds().contains(user.getId())) {
            // 채팅방 참여
            room.getParticipantIds().add(user.getId());
            room = roomRepository.save(room);
        }
        
        // Publish event for room updated
        try {
            RoomResponse roomResponse = mapToRoomResponse(room, name);
            eventPublisher.publishEvent(new RoomUpdatedEvent(this, roomId, roomResponse));
        } catch (Exception e) {
            log.error("roomUpdate 이벤트 발행 실패", e);
        }

        return room;
    }

    private RoomResponse mapToRoomResponse(Room room, String name) {
        if (room == null) return null;

        User creator = null;
        if (room.getCreator() != null) {
            creator = userRepository.findById(room.getCreator()).orElse(null);
        }

        List<User> participants = room.getParticipantIds().stream()
            .map(userRepository::findById)
            .filter(Optional::isPresent)
            .map(Optional::get)
            .toList();

        // 최근 10분간 메시지 수 조회
        LocalDateTime tenMinutesAgo = LocalDateTime.now().minusMinutes(10);
        long recentMessageCount = messageRepository.countRecentMessagesByRoomId(room.getId(), tenMinutesAgo);

        return RoomResponse.builder()
            .id(room.getId())
            .name(room.getName() != null ? room.getName() : "제목 없음")
            .hasPassword(room.isHasPassword())
            .creator(creator != null ? UserResponse.builder()
                .id(creator.getId())
                .name(creator.getName() != null ? creator.getName() : "알 수 없음")
                .email(creator.getEmail() != null ? creator.getEmail() : "")
                .build() : null)
            .participants(participants.stream()
                .filter(p -> p != null && p.getId() != null)
                .map(p -> UserResponse.builder()
                    .id(p.getId())
                    .name(p.getName() != null ? p.getName() : "알 수 없음")
                    .email(p.getEmail() != null ? p.getEmail() : "")
                    .build())
                .collect(Collectors.toList()))
            .createdAtDateTime(room.getCreatedAt())
            .isCreator(creator != null && creator.getId().equals(name))
            .recentMessageCount((int) recentMessageCount)
            .build();
    }
}
