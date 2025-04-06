const Group = require('../models/group.model');
const User = require('../models/user.model');
const Task = require('../models/task.model');
const Timer = require('../models/timer.model');
const logger = require('../utils/logger');

/**
 * Create a new group
 * @param {Object} groupData - Group data
 * @param {string} userId - Creator ID
 * @returns {Object} Created group
 */
const createGroup = async (groupData, userId) => {
  // Create new group
  const group = new Group({
    name: groupData.name,
    description: groupData.description,
    isPublic: groupData.isPublic,
    creator: userId,
    leaders: [userId],
    members: [],
  });

  await group.save();

  // Add group to user's groups
  await User.findByIdAndUpdate(userId, {
    $push: { groups: group._id }
  });

  logger.info(`Group created: ${group._id} by user: ${userId}`);

  return {
    _id: group._id,
    name: group.name,
    description: group.description,
    isPublic: group.isPublic,
    creator: group.creator,
    inviteCode: group.inviteCode,
    createdAt: group.createdAt,
  };
};

/**
 * Get group details
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID
 * @returns {Object} Group details and stats
 */
const getGroupDetails = async (groupId, userId) => {
  // Find group
  const group = await Group.findById(groupId)
    .populate('creator', 'firstName lastName avatar')
    .populate('leaders', 'firstName lastName avatar')
    .populate('members', 'firstName lastName avatar');

  if (!group) {
    throw new Error('Group not found');
  }

  // Check if user is a member or leader of the group or if the group is public
  const isLeader = group.leaders.some(leader => leader._id.toString() === userId.toString());
  const isMember = group.members.some(member => member._id.toString() === userId.toString());

  if (!isLeader && !isMember && !group.isPublic) {
    throw new Error('You do not have permission to view this group');
  }

  // Get pending tasks count
  const pendingTasksCount = await Task.countDocuments({
    group: groupId,
    status: 'pending',
  });

  // Get in-progress tasks count
  const inProgressTasksCount = await Task.countDocuments({
    group: groupId,
    status: 'in-progress',
  });

  // Get completed tasks count
  const completedTasksCount = await Task.countDocuments({
    group: groupId,
    status: 'completed',
  });

  // Get active timers count
  const activeTimersCount = await Timer.countDocuments({
    group: groupId,
    isActive: true,
  });

  return {
    group: {
      _id: group._id,
      name: group.name,
      description: group.description,
      isPublic: group.isPublic,
      avatar: group.avatar,
      creator: group.creator,
      leaders: group.leaders,
      members: group.members,
      completedTasks: group.completedTasks,
      totalTasks: group.totalTasks,
      totalTimeSpent: group.totalTimeSpent,
      inviteCode: isLeader ? group.inviteCode : undefined,
      createdAt: group.createdAt,
      lastActive: group.lastActive,
    },
    stats: {
      pendingTasks: pendingTasksCount,
      inProgressTasks: inProgressTasksCount,
      completedTasks: completedTasksCount,
      activeTimers: activeTimersCount,
    },
    userRole: isLeader ? 'leader' : (isMember ? 'member' : 'guest'),
  };
};

/**
 * Update group details
 * @param {string} groupId - Group ID
 * @param {Object} updateData - Update data
 * @param {string} userId - User ID
 * @returns {Object} Updated group
 */
const updateGroup = async (groupId, updateData, userId) => {
  // Find group
  const group = await Group.findById(groupId);

  if (!group) {
    throw new Error('Group not found');
  }

  // Check if user is a leader
  const isLeader = group.leaders.includes(userId);

  if (!isLeader) {
    throw new Error('Only group leaders can update group details');
  }

  // Update group
  const { name, description, isPublic, avatar } = updateData;
  if (name) group.name = name;
  if (description !== undefined) group.description = description;
  if (isPublic !== undefined) group.isPublic = isPublic;
  if (avatar !== undefined) group.avatar = avatar;

  await group.save();

  logger.info(`Group updated: ${group._id} by user: ${userId}`);

  return {
    _id: group._id,
    name: group.name,
    description: group.description,
    isPublic: group.isPublic,
    avatar: group.avatar,
    inviteCode: group.inviteCode,
  };
};

/**
 * Add a member to a group
 * @param {string} groupId - Group ID
 * @param {string} email - User email
 * @param {string} leaderId - Leader ID
 * @returns {Object} Added user
 */
const addMember = async (groupId, email, leaderId) => {
  // Find group
  const group = await Group.findById(groupId);

  if (!group) {
    throw new Error('Group not found');
  }

  // Check if user is a leader
  const isLeader = group.leaders.includes(leaderId);

  if (!isLeader) {
    throw new Error('Only group leaders can add members');
  }

  // Find user by email
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error('User not found');
  }

  // Check if user is already a member or leader
  if (group.members.includes(user._id) || group.leaders.includes(user._id)) {
    throw new Error('User is already a member of this group');
  }

  // Add user to group members
  group.members.push(user._id);
  await group.save();

  // Add group to user's groups
  await User.findByIdAndUpdate(user._id, {
    $push: { groups: group._id }
  });

  logger.info(`User ${user._id} added to group ${group._id} by user: ${leaderId}`);

  return {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  };
};

/**
 * Remove a member from a group
 * @param {string} groupId - Group ID
 * @param {string} memberId - Member ID
 * @param {string} actorId - Actor ID
 * @returns {boolean} Success status
 */
const removeMember = async (groupId, memberId, actorId) => {
  // Find group
  const group = await Group.findById(groupId);

  if (!group) {
    throw new Error('Group not found');
  }

  // Check if user is a leader or removing themselves
  const isLeader = group.leaders.includes(actorId);
  const isSelfRemoval = actorId.toString() === memberId.toString();

  if (!isLeader && !isSelfRemoval) {
    throw new Error('Only group leaders can remove members');
  }

  // Check if member exists
  const isMember = group.members.includes(memberId);

  if (!isMember) {
    throw new Error('User is not a member of this group');
  }

  // Check if trying to remove a leader
  const isTargetLeader = group.leaders.includes(memberId);

  if (isTargetLeader) {
    throw new Error('Cannot remove a leader. Demote to member first');
  }

  // Remove member from group
  group.members = group.members.filter(
    member => member.toString() !== memberId.toString()
  );
  await group.save();

  // Remove group from user's groups
  await User.findByIdAndUpdate(memberId, {
    $pull: { groups: group._id }
  });

  logger.info(`User ${memberId} removed from group ${group._id} by user: ${actorId}`);

  return true;
};

/**
 * Promote a member to leader
 * @param {string} groupId - Group ID
 * @param {string} memberId - Member ID
 * @param {string} leaderId - Leader ID
 * @returns {Object} Promoted user
 */
const promoteMember = async (groupId, memberId, leaderId) => {
  // Find group
  const group = await Group.findById(groupId);

  if (!group) {
    throw new Error('Group not found');
  }

  // Check if user is a leader
  const isLeader = group.leaders.includes(leaderId);

  if (!isLeader) {
    throw new Error('Only group leaders can promote members');
  }

  // Check if member exists
  const isMember = group.members.includes(memberId);

  if (!isMember) {
    throw new Error('User is not a member of this group');
  }

  // Check if already a leader
  const isAlreadyLeader = group.leaders.includes(memberId);

  if (isAlreadyLeader) {
    throw new Error('User is already a leader');
  }

  // Promote member to leader
  group.members = group.members.filter(
    member => member.toString() !== memberId.toString()
  );
  group.leaders.push(memberId);
  await group.save();

  logger.info(`User ${memberId} promoted to leader in group ${group._id} by user: ${leaderId}`);

  // Get promoted user details
  const promotedUser = await User.findById(memberId)
    .select('firstName lastName avatar');

  return {
    _id: promotedUser._id,
    firstName: promotedUser.firstName,
    lastName: promotedUser.lastName,
    avatar: promotedUser.avatar,
  };
};

/**
 * Demote a leader to member
 * @param {string} groupId - Group ID
 * @param {string} leaderId - Leader ID to demote
 * @param {string} actorId - Actor ID
 * @returns {Object} Demoted user
 */
const demoteLeader = async (groupId, leaderId, actorId) => {
  // Find group
  const group = await Group.findById(groupId);

  if (!group) {
    throw new Error('Group not found');
  }

  // Check if user is a leader
  const isLeader = group.leaders.includes(actorId);

  if (!isLeader) {
    throw new Error('Only group leaders can demote leaders');
  }

  // Check if target is a leader
  const isTargetLeader = group.leaders.includes(leaderId);

  if (!isTargetLeader) {
    throw new Error('User is not a leader');
  }

  // Check if trying to demote the creator
  if (group.creator.toString() === leaderId.toString()) {
    throw new Error('Cannot demote the group creator');
  }

  // Check if trying to demote self
  if (actorId.toString() === leaderId.toString()) {
    throw new Error('Cannot demote yourself');
  }

  // Demote leader to member
  group.leaders = group.leaders.filter(
    leader => leader.toString() !== leaderId.toString()
  );
  group.members.push(leaderId);
  await group.save();

  logger.info(`User ${leaderId} demoted to member in group ${group._id} by user: ${actorId}`);

  // Get demoted user details
  const demotedUser = await User.findById(leaderId)
    .select('firstName lastName avatar');

  return {
    _id: demotedUser._id,
    firstName: demotedUser.firstName,
    lastName: demotedUser.lastName,
    avatar: demotedUser.avatar,
  };
};

/**
 * Join a group using invite code
 * @param {string} inviteCode - Invite code
 * @param {string} userId - User ID
 * @returns {Object} Joined group
 */
const joinGroup = async (inviteCode, userId) => {
  // Find group by invite code
  const group = await Group.findOne({ inviteCode });

  if (!group) {
    throw new Error('Invalid invite code');
  }

  // Check if user is already a member or leader
  if (group.members.includes(userId) || group.leaders.includes(userId)) {
    throw new Error('You are already a member of this group');
  }

  // Add user to group members
  group.members.push(userId);
  await group.save();

  // Add group to user's groups
  await User.findByIdAndUpdate(userId, {
    $push: { groups: group._id }
  });

  logger.info(`User ${userId} joined group ${group._id} using invite code`);

  return {
    _id: group._id,
    name: group.name,
    description: group.description,
    isPublic: group.isPublic,
  };
};

/**
 * Generate a new invite code for a group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID
 * @returns {Object} New invite code
 */
const regenerateInviteCode = async (groupId, userId) => {
  // Find group
  const group = await Group.findById(groupId);

  if (!group) {
    throw new Error('Group not found');
  }

  // Check if user is a leader
  const isLeader = group.leaders.includes(userId);

  if (!isLeader) {
    throw new Error('Only group leaders can regenerate invite code');
  }

  // Generate a new invite code
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';

  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  group.inviteCode = code;
  await group.save();

  logger.info(`Invite code regenerated for group ${group._id} by user: ${userId}`);

  return { inviteCode: group.inviteCode };
};

/**
 * Get group leaderboard
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID
 * @returns {Array} Leaderboard
 */
const getLeaderboard = async (groupId, userId) => {
  // Find group
  const group = await Group.findById(groupId);

  if (!group) {
    throw new Error('Group not found');
  }

  // Check if user is a member, leader, or if the group is public
  const isLeader = group.leaders.includes(userId);
  const isMember = group.members.includes(userId);

  if (!isLeader && !isMember && !group.isPublic) {
    throw new Error('You do not have permission to view this group');
  }

  // Generate leaderboard
  return await group.generateLeaderboard();
};

/**
 * List user's groups
 * @param {string} userId - User ID
 * @returns {Object} User groups and public groups
 */
const listUserGroups = async (userId) => {
  // Find user with populated groups
  const user = await User.findById(userId).select('groups');

  // Get groups
  const groups = await Group.find({
    $or: [
      { _id: { $in: user.groups } },
      { isPublic: true },
    ],
  })
    .select('name description isPublic avatar creator leaders members completedTasks totalTasks createdAt lastActive')
    .populate('creator', 'firstName lastName')
    .sort({ lastActive: -1 });

  // Categorize groups
  const myGroups = [];
  const publicGroups = [];

  for (const group of groups) {
    // Check if user is a member or leader
    const isLeader = group.leaders.includes(userId);
    const isMember = group.members.includes(userId);

    if (isLeader || isMember) {
      myGroups.push({
        ...group.toObject(),
        role: isLeader ? 'leader' : 'member',
      });
    } else if (group.isPublic) {
      publicGroups.push({
        ...group.toObject(),
        role: 'guest',
      });
    }
  }

  return {
    myGroups,
    publicGroups,
  };
};

module.exports = {
  createGroup,
  getGroupDetails,
  updateGroup,
  addMember,
  removeMember,
  promoteMember,
  demoteLeader,
  joinGroup,
  regenerateInviteCode,
  getLeaderboard,
  listUserGroups,
};